using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Tdn.Accounts.Configuration;
using Tdn.Accounts.Security;
using Xunit;

namespace Tdn.Accounts.Tests.Security;

public sealed class OidcTokenValidatorTests
{
    [Fact]
    public async Task Valid_token_returns_only_verified_identity_and_fetches_fresh_documents_each_time()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "key1");
        var handler = StandardHandler("https://id.test", key);
        var validator = NewValidator(handler, Provider());
        var token = Token(key, "https://id.test", Claims());
        var result = await validator.ValidateAsync(token, default);
        var repeated = await validator.ValidateAsync(token, default);
        Assert.Equal(new VerifiedIdentity("https://id.test", "subject"), result.Identity);
        Assert.Equal(TokenValidationStatus.Valid, result.Status);
        Assert.Equal(result, repeated);
        Assert.Equal(4, handler.Count);
        Assert.Equal(new[] { "https://id.test/.well-known/openid-configuration", "https://id.test/jwks", "https://id.test/.well-known/openid-configuration", "https://id.test/jwks" }, handler.RequestedUris.Select(x => x.AbsoluteUri));
    }

    [Fact]
    public async Task Foreign_signing_key_and_unknown_kid_are_invalid()
    {
        using var trustedRsa = RSA.Create(2048);
        using var attackerRsa = RSA.Create(2048);
        var trusted = Key(trustedRsa, "trusted");
        var attacker = Key(attackerRsa, "attacker");
        var validator = NewValidator(StandardHandler("https://id.test", trusted), Provider());
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(Token(attacker, "https://id.test", Claims()), default)).Status);
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(Token(trusted, "https://id.test", Claims(), kid: "unknown"), default)).Status);
    }

    [Fact]
    public async Task Missing_kid_is_invalid()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var validator = NewValidator(StandardHandler("https://id.test", key), Provider());
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(Token(key, "https://id.test", Claims(), includeKid: false), default)).Status);
    }

    [Fact]
    public async Task None_and_hs256_are_invalid()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var validator = NewValidator(StandardHandler("https://id.test", key), Provider());
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(UnsecuredToken("https://id.test", Claims()), default)).Status);
        var hs = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("test-only-symmetric-key-material-32"));
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(Token(hs, "https://id.test", Claims(), SecurityAlgorithms.HmacSha256), default)).Status);
    }

    [Theory]
    [InlineData("missing-exp")]
    [InlineData("missing-sub")]
    [InlineData("array-sub")]
    [InlineData("expired")]
    [InlineData("future-nbf")]
    [InlineData("wrong-audience")]
    [InlineData("wrong-issuer")]
    public async Task Required_registered_claims_and_lifetime_are_enforced(string mode)
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = StandardHandler("https://id.test", key);
        var validator = NewValidator(handler, Provider());
        var claims = Claims();
        if (mode == "missing-exp") claims.Remove("exp");
        if (mode == "missing-sub") claims.Remove("sub");
        if (mode == "array-sub") claims["sub"] = new[] { "subject" };
        if (mode == "expired") claims["exp"] = DateTimeOffset.UtcNow.AddMinutes(-4).ToUnixTimeSeconds();
        if (mode == "future-nbf") claims["nbf"] = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
        if (mode == "wrong-audience") claims["aud"] = "other";
        var issuer = mode == "wrong-issuer" ? "https://other.test" : "https://id.test";
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(Token(key, issuer, claims), default)).Status);
    }

    [Theory]
    [InlineData("ID")]
    [InlineData("Refresh")]
    [InlineData("missing")]
    public async Task Configured_access_type_marker_rejects_non_access_tokens(string marker)
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var provider = Provider();
        provider.ValidHeaderTypes = ["JWT"];
        provider.AccessTokenTypeClaim = "typ";
        provider.AccessTokenTypeValues = ["Bearer"];
        var validator = NewValidator(StandardHandler("https://id.test", key), provider);
        var claims = Claims();
        if (marker != "missing") claims["typ"] = marker;
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(Token(key, "https://id.test", claims, typ: "JWT"), default)).Status);
    }

    [Fact]
    public async Task Standard_at_jwt_header_is_accepted_without_generic_marker()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var result = await NewValidator(StandardHandler("https://id.test", key), Provider()).ValidateAsync(Token(key, "https://id.test", Claims(), typ: "at+jwt"), default);
        Assert.Equal(TokenValidationStatus.Valid, result.Status);
    }

    [Fact]
    public async Task Rotated_jwks_is_used_on_next_validation_without_restart_or_cache()
    {
        using var rsa1 = RSA.Create(2048);
        using var rsa2 = RSA.Create(2048);
        var key1 = Key(rsa1, "old");
        var key2 = Key(rsa2, "new");
        var active = key1;
        var handler = new StubHandler((uri, _) => Task.FromResult(JsonResponse(uri.AbsolutePath.EndsWith("jwks", StringComparison.Ordinal) ? Jwks(active) : Metadata("https://id.test", "https://id.test/jwks"))));
        var validator = NewValidator(handler, Provider());
        var oldToken = Token(key1, "https://id.test", Claims());
        var newToken = Token(key2, "https://id.test", Claims());
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(newToken, default)).Status);
        active = key2;
        var firstNew = await validator.ValidateAsync(newToken, default);
        Assert.Equal(TokenValidationStatus.Valid, firstNew.Status);
        Assert.Equal(new VerifiedIdentity("https://id.test", "subject"), firstNew.Identity);
        Assert.Equal(TokenValidationStatus.Invalid, (await validator.ValidateAsync(oldToken, default)).Status);
        Assert.Equal(6, handler.Count);
    }

    [Fact]
    public async Task Different_configured_providers_keep_same_subjects_isolated_by_issuer()
    {
        using var rsaA = RSA.Create(2048);
        using var rsaB = RSA.Create(2048);
        var keyA = Key(rsaA, "a");
        var keyB = Key(rsaB, "b");
        var handler = new StubHandler((uri, _) => Task.FromResult(JsonResponse(uri.Host == "a.test"
            ? uri.AbsolutePath.EndsWith("jwks", StringComparison.Ordinal) ? Jwks(keyA) : Metadata("https://a.test", "https://a.test/jwks")
            : uri.AbsolutePath.EndsWith("jwks", StringComparison.Ordinal) ? Jwks(keyB) : Metadata("https://b.test", "https://b.test/jwks"))));
        var options = new OidcOptions { Providers = [Provider("https://a.test"), Provider("https://b.test")] };
        var validator = NewValidator(handler, options);
        var a = await validator.ValidateAsync(Token(keyA, "https://a.test", Claims()), default);
        var b = await validator.ValidateAsync(Token(keyB, "https://b.test", Claims()), default);
        Assert.Equal(new VerifiedIdentity("https://a.test", "subject"), a.Identity);
        Assert.Equal(new VerifiedIdentity("https://b.test", "subject"), b.Identity);
    }

    [Fact]
    public async Task Untrusted_jku_and_x5u_do_not_change_discovery_or_jwks_requests()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = StandardHandler("https://id.test", key);
        var result = await NewValidator(handler, Provider()).ValidateAsync(Token(key, "https://id.test", Claims(), headerValues: new Dictionary<string, object> { ["jku"] = "https://evil.test/jwks", ["x5u"] = "https://evil.test/cert" }), default);
        Assert.Equal(TokenValidationStatus.Valid, result.Status);
        Assert.Equal(new[] { "https://id.test/.well-known/openid-configuration", "https://id.test/jwks" }, handler.RequestedUris.Select(u => u.AbsoluteUri));
    }

    [Fact]
    public async Task Metadata_issuer_mismatch_is_dependency_unavailable()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = new StubHandler((_, _) => Task.FromResult(JsonResponse(Metadata("https://foreign.test", "https://id.test/jwks"))));
        var result = await NewValidator(handler, Provider()).ValidateAsync(Token(key, "https://id.test", Claims()), default);
        Assert.Equal(TokenValidationStatus.Unavailable, result.Status);
        Assert.Equal(1, handler.Count);
    }

    [Fact]
    public async Task Unpinned_foreign_jwks_is_not_requested_but_exact_pin_allows_cross_origin()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var token = Token(key, "https://id.test", Claims());
        var foreign = new StubHandler((uri, _) => Task.FromResult(JsonResponse(uri.Host == "id.test" ? Metadata("https://id.test", "https://keys.test/jwks") : Jwks(key))));
        Assert.Equal(TokenValidationStatus.Unavailable, (await NewValidator(foreign, Provider()).ValidateAsync(token, default)).Status);
        Assert.Single(foreign.RequestedUris);
        var pinnedProvider = Provider();
        pinnedProvider.JwksUri = "https://keys.test/jwks";
        var pinned = new StubHandler((uri, _) => Task.FromResult(JsonResponse(uri.Host == "id.test" ? Metadata("https://id.test", "https://keys.test/jwks") : Jwks(key))));
        Assert.Equal(TokenValidationStatus.Valid, (await NewValidator(pinned, pinnedProvider).ValidateAsync(token, default)).Status);
        Assert.Equal("https://keys.test/jwks", pinned.RequestedUris[1].AbsoluteUri);
    }

    [Fact]
    public async Task Http_jwks_is_rejected_before_request_when_development_http_is_disabled()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = new StubHandler((uri, _) => Task.FromResult(JsonResponse(Metadata("https://id.test", "http://id.test/jwks"))));
        Assert.Equal(TokenValidationStatus.Unavailable, (await NewValidator(handler, Provider()).ValidateAsync(Token(key, "https://id.test", Claims()), default)).Status);
        Assert.Single(handler.RequestedUris);
    }

    [Theory]
    [InlineData("metadata")]
    [InlineData("jwks")]
    public async Task Redirect_responses_are_dependency_unavailable(string endpoint)
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = new StubHandler((uri, _) => Task.FromResult(uri.AbsolutePath.EndsWith(endpoint == "jwks" ? "jwks" : "configuration", StringComparison.Ordinal)
            ? new HttpResponseMessage(HttpStatusCode.Redirect) { Headers = { Location = new Uri("https://elsewhere.test/") } }
            : JsonResponse(Metadata("https://id.test", "https://id.test/jwks"))));
        var result = await NewValidator(handler, Provider()).ValidateAsync(Token(key, "https://id.test", Claims()), default);
        Assert.Equal(TokenValidationStatus.Unavailable, result.Status);
    }

    [Fact]
    public async Task Malformed_jwks_is_dependency_unavailable()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = new StubHandler((uri, _) => Task.FromResult(JsonResponse(uri.AbsolutePath.EndsWith("jwks", StringComparison.Ordinal) ? "{bad" : Metadata("https://id.test", "https://id.test/jwks"))));
        Assert.Equal(TokenValidationStatus.Unavailable, (await NewValidator(handler, Provider()).ValidateAsync(Token(key, "https://id.test", Claims()), default)).Status);
    }

    [Theory]
    [InlineData("request")]
    [InlineData("timeout")]
    public async Task Network_errors_and_timeout_are_dependency_unavailable(string failure)
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = new StubHandler((_, _) => failure == "request" ? throw new HttpRequestException() : throw new TaskCanceledException());
        Assert.Equal(TokenValidationStatus.Unavailable, (await NewValidator(handler, Provider()).ValidateAsync(Token(key, "https://id.test", Claims()), default)).Status);
    }

    [Theory]
    [InlineData(null, TokenValidationStatus.InsufficientScope)]
    [InlineData("read", TokenValidationStatus.InsufficientScope)]
    [InlineData("read write", TokenValidationStatus.Valid)]
    public async Task Required_scopes_are_checked(string? scope, TokenValidationStatus expected)
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var provider = Provider();
        provider.RequiredScopes = ["read", "write"];
        var claims = Claims();
        if (scope is not null) claims["scope"] = scope;
        Assert.Equal(expected, (await NewValidator(StandardHandler("https://id.test", key), provider).ValidateAsync(Token(key, "https://id.test", claims), default)).Status);
    }

    [Fact]
    public async Task Malformed_provider_options_fail_before_any_http_request()
    {
        using var rsa = RSA.Create(2048);
        var key = Key(rsa, "trusted");
        var handler = StandardHandler("https://id.test", key);
        var provider = Provider();
        provider.MetadataAddress = "http://user:pass@id.test/config#fragment";
        Assert.Throws<InvalidOperationException>(() => NewValidator(handler, provider));
        Assert.Empty(handler.RequestedUris);
    }

    [Fact]
    public void Empty_optional_environment_values_normalize_as_absent_and_blank_marker_values_fail()
    {
        var provider = Provider();
        provider.MetadataAddress = "";
        provider.JwksUri = " ";
        provider.AccessTokenTypeClaim = "";
        provider.RequiredScopes = ["", " "];
        provider.Validate();
        Assert.Null(provider.MetadataAddress);
        Assert.Null(provider.JwksUri);
        Assert.Null(provider.AccessTokenTypeClaim);
        Assert.Empty(provider.RequiredScopes);
        provider.ValidHeaderTypes = ["JWT"];
        provider.AccessTokenTypeClaim = "typ";
        provider.AccessTokenTypeValues = [" "];
        Assert.Throws<InvalidOperationException>(provider.Validate);
    }

    private static Dictionary<string, object> Claims() => new() { ["sub"] = "subject", ["aud"] = "account", ["exp"] = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds() };
    private static OidcProviderOptions Provider(string issuer = "https://id.test") => new() { Issuer = issuer, MetadataAddress = issuer + "/.well-known/openid-configuration", Audiences = ["account"] };
    private static OidcTokenValidator NewValidator(StubHandler handler, OidcProviderOptions provider) => NewValidator(handler, new OidcOptions { Providers = [provider] });
    private static OidcTokenValidator NewValidator(StubHandler handler, OidcOptions options) => new(options, new StubFactory(handler));
    private static RsaSecurityKey Key(RSA rsa, string id) => new(rsa) { KeyId = id };
    private static StubHandler StandardHandler(string issuer, SecurityKey key) => new((uri, _) => Task.FromResult(JsonResponse(uri.AbsolutePath.EndsWith("jwks", StringComparison.Ordinal) ? Jwks(key) : Metadata(issuer, issuer + "/jwks"))));
    private static string Metadata(string issuer, string jwks) => JsonSerializer.Serialize(new { issuer, jwks_uri = jwks });
    private static string Jwks(SecurityKey key)
    {
        var rsa = (RSA)((RsaSecurityKey)key).Rsa!;
        var parameters = rsa.ExportParameters(false);
        return JsonSerializer.Serialize(new { keys = new[] { new { kty = "RSA", kid = key.KeyId, use = "sig", alg = "RS256", n = Base64UrlEncoder.Encode(parameters.Modulus!), e = Base64UrlEncoder.Encode(parameters.Exponent!) } } });
    }
    private static HttpResponseMessage JsonResponse(string value) => new(HttpStatusCode.OK) { Content = new StringContent(value, Encoding.UTF8, "application/json") };
    private static string Token(SecurityKey key, string issuer, IDictionary<string, object> claims, string algorithm = SecurityAlgorithms.RsaSha256, string typ = "at+jwt", string? kid = null, IDictionary<string, object>? headerValues = null, bool includeKid = true)
    {
        var signingKey = key;
        if (key is RsaSecurityKey rsaKey && (kid is not null || !includeKid)) signingKey = new RsaSecurityKey(rsaKey.Rsa!) { KeyId = includeKid ? kid : null };
        var payload = new JwtPayload { ["iss"] = issuer, ["iat"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds() };
        foreach (var claim in claims) payload[claim.Key] = claim.Value;
        var credentials = new SigningCredentials(signingKey, algorithm);
        var header = new JwtHeader(credentials) { ["typ"] = typ };
        if (!includeKid) header.Remove("kid");
        if (headerValues is not null) foreach (var value in headerValues) header[value.Key] = value.Value;
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(header, payload));
    }
    private static string UnsecuredToken(string issuer, IDictionary<string, object> claims)
    {
        var payload = new JwtPayload { ["iss"] = issuer };
        foreach (var claim in claims) payload[claim.Key] = claim.Value;
        var head = Base64UrlEncoder.Encode(JsonSerializer.SerializeToUtf8Bytes(new { alg = "none", typ = "at+jwt" }));
        var body = Base64UrlEncoder.Encode(JsonSerializer.SerializeToUtf8Bytes(payload));
        return head + "." + body + ".";
    }

    private sealed class StubHandler(Func<Uri, CancellationToken, Task<HttpResponseMessage>> response) : HttpMessageHandler
    {
        public List<Uri> RequestedUris { get; } = [];
        public int Count => RequestedUris.Count;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestedUris.Add(request.RequestUri!);
            return response(request.RequestUri!, cancellationToken);
        }
    }
    private sealed class StubFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, false);
    }
}
