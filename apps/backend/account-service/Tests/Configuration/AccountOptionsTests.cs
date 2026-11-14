using Tdn.Accounts.Configuration;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Tdn.Accounts.Tests.Configuration;

public sealed class AccountOptionsTests
{
    [Fact]
    public void Generic_header_type_requires_marker()
    {
        var options = Provider();
        options.ValidHeaderTypes = ["JWT"];
        Assert.Throws<InvalidOperationException>(options.Validate);
    }

    [Fact]
    public void Supported_generic_type_marker_and_algorithms_validate()
    {
        var options = Provider();
        options.ValidHeaderTypes = ["JWT"];
        options.AccessTokenTypeClaim = "typ";
        options.AccessTokenTypeValues = ["Bearer"];
        options.Validate();
    }

    [Theory]
    [InlineData("HS256")]
    [InlineData("RSunknown")]
    [InlineData("none")]
    public void Symmetric_or_unknown_algorithm_is_rejected(string algorithm)
    {
        var options = Provider();
        options.AllowedAlgorithms = [algorithm];
        Assert.Throws<InvalidOperationException>(options.Validate);
    }

    [Fact]
    public void Configuration_binding_keeps_explicit_algorithm_and_header_lists_exact()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Oidc:Providers:0:Issuer"] = "https://issuer.test",
            ["Oidc:Providers:0:Audiences:0"] = "account",
            ["Oidc:Providers:0:AllowedAlgorithms:0"] = "ES256",
            ["Oidc:Providers:0:ValidHeaderTypes:0"] = "JWT",
            ["Oidc:Providers:0:AccessTokenTypeClaim"] = "typ",
            ["Oidc:Providers:0:AccessTokenTypeValues:0"] = "Bearer"
        }).Build();
        var options = config.GetSection("Oidc").Get<OidcOptions>()!;
        options.Validate();
        Assert.Equal(new[] { "ES256" }, options.Providers[0].AllowedAlgorithms);
        Assert.Equal(new[] { "JWT" }, options.Providers[0].ValidHeaderTypes);
    }

    [Fact]
    public void Configuration_binding_applies_secure_list_defaults_when_unset()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Oidc:Providers:0:Issuer"] = "https://issuer.test",
            ["Oidc:Providers:0:Audiences:0"] = "account"
        }).Build();
        var options = config.GetSection("Oidc").Get<OidcOptions>()!;
        options.Validate();
        Assert.Equal(new[] { "RS256" }, options.Providers[0].AllowedAlgorithms);
        Assert.Equal(new[] { "at+jwt", "application/at+jwt" }, options.Providers[0].ValidHeaderTypes);
    }

    [Fact]
    public void Internal_auth_configuration_rejects_both_key_sources()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["InternalAuth:ApiKey"] = new string('x', 32),
            ["InternalAuth:ApiKeyFile"] = "ignored-by-conflict-validation"
        }).Build();
        var options = config.GetSection("InternalAuth").Get<InternalAuthOptions>()!;
        Assert.Throws<InvalidOperationException>(options.ResolveKey);
    }

    [Fact]
    public void Blank_direct_key_falls_back_to_file_and_trims_only_line_endings()
    {
        var path = Path.GetTempFileName();
        var key = new string('k', 32);
        try
        {
            File.WriteAllText(path, key + "\r\n");
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InternalAuth:ApiKey"] = " ",
                ["InternalAuth:ApiKeyFile"] = path
            }).Build();
            Assert.Equal(key, config.GetSection("InternalAuth").Get<InternalAuthOptions>()!.ResolveKey());
        }
        finally { File.Delete(path); }
    }

    private static OidcProviderOptions Provider() => new() { Issuer = "https://issuer.test", Audiences = ["account"] };
}
