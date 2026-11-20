using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using Tdn.Accounts.Configuration;

namespace Tdn.Accounts.Security;

public sealed record VerifiedIdentity(string Issuer, string Subject);
public enum TokenValidationStatus { Valid, Invalid, InsufficientScope, Unavailable }
public sealed record TokenValidationResult(TokenValidationStatus Status, VerifiedIdentity? Identity = null);

public sealed class OidcTokenValidator
{
    private sealed record CachedResult(TokenValidationResult Result, DateTimeOffset ExpiresAt);
    private readonly OidcOptions options;
    private readonly IHttpClientFactory clients;
    private readonly IMemoryCache cache;
    private readonly TimeProvider timeProvider;
    private readonly string cacheNamespace = Guid.NewGuid().ToString("N");
    private readonly ConcurrentDictionary<string, Lazy<Task<TokenValidationResult>>> inFlight = new(StringComparer.Ordinal);

    public OidcTokenValidator(OidcOptions options, IHttpClientFactory clients, IMemoryCache cache, TimeProvider timeProvider)
    {
        options.Validate();
        this.options = options;
        this.clients = clients;
        this.cache = cache;
        this.timeProvider = timeProvider;
    }

    public async Task<TokenValidationResult> ValidateAsync(string token, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        if (token.Length > 16384) return new(TokenValidationStatus.Invalid);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        var cacheKey = $"oidc-validation:{cacheNamespace}:{hash}";
        if (TryReadCached(cacheKey, out var cachedResult)) return cachedResult;

        Lazy<Task<TokenValidationResult>>? candidate = null;
        candidate = new Lazy<Task<TokenValidationResult>>(
            () => ValidateAndCleanupAsync(token, hash, cacheKey, candidate!), LazyThreadSafetyMode.ExecutionAndPublication);
        var work = inFlight.GetOrAdd(hash, candidate);
        return await work.Value.WaitAsync(ct);
    }

    private async Task<TokenValidationResult> ValidateAndCleanupAsync(string token, string hash, string cacheKey, Lazy<Task<TokenValidationResult>> work)
    {
        try
        {
            if (TryReadCached(cacheKey, out var cachedResult)) return cachedResult;
            var (result, expiresAt) = await ValidateFullyAsync(token);
            var now = timeProvider.GetUtcNow();
            if (result.Status == TokenValidationStatus.Valid && result.Identity is not null && expiresAt > now && options.ValidationCacheDuration > TimeSpan.Zero)
            {
                var remainingTokenLifetime = expiresAt - now;
                var cacheExpiresAt = options.ValidationCacheDuration >= remainingTokenLifetime ? expiresAt : now + options.ValidationCacheDuration;
                if (cacheExpiresAt > now)
                {
                    cache.Set(cacheKey, new CachedResult(result, cacheExpiresAt), new MemoryCacheEntryOptions { AbsoluteExpiration = cacheExpiresAt });
                }
            }
            return result;
        }
        finally
        {
            if (inFlight.TryGetValue(hash, out var current) && ReferenceEquals(current, work)) inFlight.TryRemove(hash, out _);
        }
    }

    private bool TryReadCached(string cacheKey, out TokenValidationResult result)
    {
        if (options.ValidationCacheDuration > TimeSpan.Zero && cache.TryGetValue<CachedResult>(cacheKey, out var cached)
            && cached is not null && cached.ExpiresAt > timeProvider.GetUtcNow())
        {
            result = cached.Result;
            return true;
        }
        result = null!;
        return false;
    }

    private async Task<(TokenValidationResult Result, DateTimeOffset ExpiresAt)> ValidateFullyAsync(string token)
    {
        JwtSecurityToken parsed;
        try { parsed = new JwtSecurityTokenHandler().ReadJwtToken(token); } catch { return (new(TokenValidationStatus.Invalid), DateTimeOffset.MinValue); }
        if (!parsed.Header.TryGetValue("kid", out var kidValue) || kidValue is not string kid || string.IsNullOrWhiteSpace(kid)) return (new(TokenValidationStatus.Invalid), DateTimeOffset.MinValue);
        var provider = options.Providers.SingleOrDefault(p => StringComparer.Ordinal.Equals(p.Issuer, parsed.Issuer));
        if (provider is null) return (new(TokenValidationStatus.Invalid), DateTimeOffset.MinValue);
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(options.TimeoutSeconds));
            var client = clients.CreateClient("oidc");
            CheckRemoteUri(provider.MetadataUri, provider.AllowHttpForDevelopment);
            using var mr = await client.GetAsync(provider.MetadataUri, timeout.Token);
            if (!mr.IsSuccessStatusCode) return (new(TokenValidationStatus.Unavailable), DateTimeOffset.MinValue);
            using var metadata = JsonDocument.Parse(await mr.Content.ReadAsStringAsync(timeout.Token));
            var root = metadata.RootElement;
            if (!StringComparer.Ordinal.Equals(root.GetProperty("issuer").GetString(), provider.Issuer) || !Uri.TryCreate(root.GetProperty("jwks_uri").GetString(), UriKind.Absolute, out var jwks)) return (new(TokenValidationStatus.Unavailable), DateTimeOffset.MinValue);
            CheckRemoteUri(jwks, provider.AllowHttpForDevelopment);
            if (provider.JwksUri is not null)
            {
                if (!StringComparer.Ordinal.Equals(provider.JwksUri, jwks.AbsoluteUri)) return (new(TokenValidationStatus.Unavailable), DateTimeOffset.MinValue);
            }
            else
            {
                var origin = new Uri(provider.MetadataAddress ?? provider.Issuer);
                if (!StringComparer.Ordinal.Equals(jwks.GetLeftPart(UriPartial.Authority), origin.GetLeftPart(UriPartial.Authority))) return (new(TokenValidationStatus.Unavailable), DateTimeOffset.MinValue);
            }
            using var kr = await client.GetAsync(jwks, timeout.Token);
            if (!kr.IsSuccessStatusCode) return (new(TokenValidationStatus.Unavailable), DateTimeOffset.MinValue);
            var jwksJson = await kr.Content.ReadAsStringAsync(timeout.Token);
            var keys = new JsonWebKeySet(jwksJson).GetSigningKeys().Where(key => StringComparer.Ordinal.Equals(key.KeyId, kid)).ToArray();
            if (keys.Length == 0) return (new(TokenValidationStatus.Invalid), DateTimeOffset.MinValue);
            var parameters = new TokenValidationParameters
            {
                RequireSignedTokens = true, RequireExpirationTime = true, RequireAudience = true,
                ValidateIssuer = true, ValidIssuer = provider.Issuer, ValidateAudience = true, ValidAudiences = provider.Audiences,
                IgnoreTrailingSlashWhenValidatingAudience = false, ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(provider.ClockSkewSeconds),
                ValidateIssuerSigningKey = true, IssuerSigningKeys = keys, TryAllIssuerSigningKeys = false, ValidAlgorithms = provider.AllowedAlgorithms, ValidTypes = provider.ValidHeaderTypes
            };
            JwtSecurityToken valid;
            try { new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(token, parameters, out var validated); valid = (JwtSecurityToken)validated; }
            catch (SecurityTokenException) { return (new(TokenValidationStatus.Invalid), DateTimeOffset.MinValue); }
            if (!valid.Payload.TryGetValue("sub", out var subValue) || subValue is not string subject || string.IsNullOrEmpty(subject) || subject.Length > 255) return (new(TokenValidationStatus.Invalid), DateTimeOffset.MinValue);
            if (provider.AccessTokenTypeClaim is not null && (!valid.Payload.TryGetValue(provider.AccessTokenTypeClaim, out var marker) || marker is not string markerText || !provider.AccessTokenTypeValues.Contains(markerText, StringComparer.Ordinal))) return (new(TokenValidationStatus.Invalid), DateTimeOffset.MinValue);
            if (provider.RequiredScopes.Count > 0)
            {
                if (!valid.Payload.TryGetValue("scope", out var scopeValue) || scopeValue is not string scopeText) return (new(TokenValidationStatus.InsufficientScope), DateTimeOffset.MinValue);
                var scopes = scopeText.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
                if (provider.RequiredScopes.Any(s => !scopes.Contains(s))) return (new(TokenValidationStatus.InsufficientScope), DateTimeOffset.MinValue);
            }
            return (new(TokenValidationStatus.Valid, new(valid.Issuer, subject)), new DateTimeOffset(valid.ValidTo, TimeSpan.Zero));
        }
        catch (OperationCanceledException) { return (new(TokenValidationStatus.Unavailable), DateTimeOffset.MinValue); }
        catch { return (new(TokenValidationStatus.Unavailable), DateTimeOffset.MinValue); }
    }

    private static void CheckRemoteUri(Uri uri, bool allowHttp)
    {
        if (!string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Fragment) || (uri.Scheme != Uri.UriSchemeHttps && !(allowHttp && uri.Scheme == Uri.UriSchemeHttp))) throw new InvalidOperationException();
    }
}
