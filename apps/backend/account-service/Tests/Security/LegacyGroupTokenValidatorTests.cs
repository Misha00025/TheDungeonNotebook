using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Tdn.Accounts.Configuration;
using Tdn.Accounts.Security;
using Xunit;

namespace Tdn.Accounts.Tests.Security;

public sealed class LegacyGroupTokenValidatorTests
{
    [Fact]
    public void Valid_legacy_group_token_returns_group_principal()
    {
        WithValidator((validator, key) =>
        {
            var result = validator.Verify(Token(key, "legacy-issuer", "api-gateway", new Dictionary<string, object> { ["sub"] = "31", ["groupId"] = "31", ["access_level"] = "4" }));
            Assert.Equal(new GroupPrincipal(31, 4), result);
        });
    }

    [Fact]
    public void User_token_and_mixed_identity_token_are_rejected()
    {
        WithValidator((validator, key) =>
        {
            Assert.Null(validator.Verify(Token(key, "legacy-issuer", "api-gateway", new Dictionary<string, object> { ["sub"] = "7", ["userId"] = "7" })));
            Assert.Null(validator.Verify(Token(key, "legacy-issuer", "api-gateway", new Dictionary<string, object> { ["sub"] = "31", ["groupId"] = "31", ["accountId"] = 2, ["access_level"] = 1 })));
        });
    }

    [Fact]
    public void Issuer_audience_expiry_and_signature_are_validated()
    {
        WithValidator((validator, key) =>
        {
            var claims = new Dictionary<string, object> { ["sub"] = "31", ["groupId"] = "31", ["access_level"] = 0 };
            Assert.Null(validator.Verify(Token(key, "other", "api-gateway", claims)));
            Assert.Null(validator.Verify(Token(key, "legacy-issuer", "other", claims)));
            Assert.Null(validator.Verify(Token(key, "legacy-issuer", "api-gateway", claims, DateTimeOffset.UtcNow.AddMinutes(-2))));
            using var wrongRsa = RSA.Create(2048);
            Assert.Null(validator.Verify(Token(new RsaSecurityKey(wrongRsa), "legacy-issuer", "api-gateway", claims)));
        });
    }

    [Fact]
    public void Disabled_validator_does_not_read_key_file()
    {
        var validator = new LegacyGroupTokenValidator(new LegacyGroupsOptions { Enabled = false, PublicKeyPath = "/path/that/does/not/exist" });
        Assert.Null(validator.Verify("not-a-token"));
    }

    [Fact]
    public void Configuration_rejects_issuer_shared_with_oidc()
    {
        var legacy = new LegacyGroupsOptions { Enabled = true, Issuer = "https://issuer.test", Audience = "api-gateway", PublicKeyPath = "path", ClockSkewSeconds = 0 };
        var oidc = new OidcOptions { Providers = [new OidcProviderOptions { Issuer = "https://issuer.test" }] };
        Assert.Throws<InvalidOperationException>(() => legacy.Validate(oidc));
    }

    private static void WithValidator(Action<LegacyGroupTokenValidator, RsaSecurityKey> action)
    {
        using var rsa = RSA.Create(2048);
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, rsa.ExportSubjectPublicKeyInfoPem());
            using var validator = new LegacyGroupTokenValidator(new LegacyGroupsOptions { Enabled = true, Issuer = "legacy-issuer", Audience = "api-gateway", PublicKeyPath = path });
            action(validator, new RsaSecurityKey(rsa));
        }
        finally { File.Delete(path); }
    }

    private static string Token(SecurityKey key, string issuer, string audience, IDictionary<string, object> claims, DateTimeOffset? expires = null)
    {
        var payload = new JwtPayload { ["iss"] = issuer, ["aud"] = audience, ["exp"] = (expires ?? DateTimeOffset.UtcNow.AddMinutes(5)).ToUnixTimeSeconds() };
        foreach (var claim in claims) payload[claim.Key] = claim.Value;
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(new JwtHeader(new SigningCredentials(key, SecurityAlgorithms.RsaSha256)), payload));
    }
}
