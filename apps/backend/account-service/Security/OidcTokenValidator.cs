using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Tdn.Accounts.Configuration;

namespace Tdn.Accounts.Security;

public sealed record VerifiedIdentity(string Issuer, string Subject);
public enum TokenValidationStatus { Valid, Invalid, InsufficientScope, Unavailable }
public sealed record TokenValidationResult(TokenValidationStatus Status, VerifiedIdentity? Identity = null);

public sealed class OidcTokenValidator
{
    private readonly OidcOptions options;
    private readonly IHttpClientFactory clients;

    public OidcTokenValidator(OidcOptions options, IHttpClientFactory clients)
    {
        options.Validate();
        this.options = options;
        this.clients = clients;
    }

    public async Task<TokenValidationResult> ValidateAsync(string token, CancellationToken ct)
    {
        if (token.Length > 16384) return new(TokenValidationStatus.Invalid);
        JwtSecurityToken parsed;
        try { parsed = new JwtSecurityTokenHandler().ReadJwtToken(token); } catch { return new(TokenValidationStatus.Invalid); }
        if (!parsed.Header.TryGetValue("kid", out var kidValue) || kidValue is not string kid || string.IsNullOrWhiteSpace(kid)) return new(TokenValidationStatus.Invalid);
        var provider = options.Providers.SingleOrDefault(p => StringComparer.Ordinal.Equals(p.Issuer, parsed.Issuer));
        if (provider is null) return new(TokenValidationStatus.Invalid);
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(options.TimeoutSeconds));
            var client = clients.CreateClient("oidc");
            CheckRemoteUri(provider.MetadataUri, provider.AllowHttpForDevelopment);
            using var mr = await client.GetAsync(provider.MetadataUri, timeout.Token);
            if (!mr.IsSuccessStatusCode) return new(TokenValidationStatus.Unavailable);
            using var metadata = JsonDocument.Parse(await mr.Content.ReadAsStringAsync(timeout.Token));
            var root = metadata.RootElement;
            if (!StringComparer.Ordinal.Equals(root.GetProperty("issuer").GetString(), provider.Issuer) || !Uri.TryCreate(root.GetProperty("jwks_uri").GetString(), UriKind.Absolute, out var jwks)) return new(TokenValidationStatus.Unavailable);
            CheckRemoteUri(jwks, provider.AllowHttpForDevelopment);
            if (provider.JwksUri is not null)
            {
                if (!StringComparer.Ordinal.Equals(provider.JwksUri, jwks.AbsoluteUri)) return new(TokenValidationStatus.Unavailable);
            }
            else
            {
                var origin = new Uri(provider.MetadataAddress ?? provider.Issuer);
                if (!StringComparer.Ordinal.Equals(jwks.GetLeftPart(UriPartial.Authority), origin.GetLeftPart(UriPartial.Authority))) return new(TokenValidationStatus.Unavailable);
            }
            using var kr = await client.GetAsync(jwks, timeout.Token);
            if (!kr.IsSuccessStatusCode) return new(TokenValidationStatus.Unavailable);
            var jwksJson = await kr.Content.ReadAsStringAsync(timeout.Token);
            var keys = new JsonWebKeySet(jwksJson).GetSigningKeys().Where(key => StringComparer.Ordinal.Equals(key.KeyId, kid)).ToArray();
            if (keys.Length == 0) return new(TokenValidationStatus.Invalid);
            var parameters = new TokenValidationParameters
            {
                RequireSignedTokens = true, RequireExpirationTime = true, RequireAudience = true,
                ValidateIssuer = true, ValidIssuer = provider.Issuer, ValidateAudience = true, ValidAudiences = provider.Audiences,
                IgnoreTrailingSlashWhenValidatingAudience = false, ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(provider.ClockSkewSeconds),
                ValidateIssuerSigningKey = true, IssuerSigningKeys = keys, TryAllIssuerSigningKeys = false, ValidAlgorithms = provider.AllowedAlgorithms, ValidTypes = provider.ValidHeaderTypes
            };
            JwtSecurityToken valid;
            try { new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(token, parameters, out var validated); valid = (JwtSecurityToken)validated; }
            catch (SecurityTokenException) { return new(TokenValidationStatus.Invalid); }
            if (!valid.Payload.TryGetValue("sub", out var subValue) || subValue is not string subject || string.IsNullOrEmpty(subject) || subject.Length > 255) return new(TokenValidationStatus.Invalid);
            if (provider.AccessTokenTypeClaim is not null && (!valid.Payload.TryGetValue(provider.AccessTokenTypeClaim, out var marker) || marker is not string markerText || !provider.AccessTokenTypeValues.Contains(markerText, StringComparer.Ordinal))) return new(TokenValidationStatus.Invalid);
            if (provider.RequiredScopes.Count > 0)
            {
                if (!valid.Payload.TryGetValue("scope", out var scopeValue) || scopeValue is not string scopeText) return new(TokenValidationStatus.InsufficientScope);
                var scopes = scopeText.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
                if (provider.RequiredScopes.Any(s => !scopes.Contains(s))) return new(TokenValidationStatus.InsufficientScope);
            }
            return new(TokenValidationStatus.Valid, new(valid.Issuer, subject));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (OperationCanceledException) { return new(TokenValidationStatus.Unavailable); }
        catch { return new(TokenValidationStatus.Unavailable); }
    }

    private static void CheckRemoteUri(Uri uri, bool allowHttp)
    {
        if (!string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Fragment) || (uri.Scheme != Uri.UriSchemeHttps && !(allowHttp && uri.Scheme == Uri.UriSchemeHttp))) throw new InvalidOperationException();
    }
}
