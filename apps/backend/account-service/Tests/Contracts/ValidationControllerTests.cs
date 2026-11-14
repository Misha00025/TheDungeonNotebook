using System.Text.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Tdn.Accounts.Configuration;
using Tdn.Accounts.Controllers;
using Tdn.Accounts.Persistence;
using Tdn.Accounts.Security;
using Xunit;

namespace Tdn.Accounts.Tests.Contracts;

public sealed class ValidationControllerTests
{
    [Fact]
    public async Task Wrong_internal_key_stops_before_oidc_or_store_and_returns_no_store()
    {
        var handler = new CountingHandler();
        var store = new SpyStore();
        var controller = Make(handler, store);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.Request.Headers["X-Account-Service-Key"] = "incorrect";
        controller.Request.Headers.Authorization = "Bearer eyJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL2lkLnRlc3QifQ.";
        Assert.IsType<UnauthorizedResult>(await controller.Validate(default));
        Assert.Equal(0, handler.Count);
        Assert.Equal(0, store.Calls);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl);
    }

    [Fact]
    public async Task Unknown_issuer_contract_omits_account_id_and_error()
    {
        var handler = new CountingHandler();
        var controller = Make(handler, new SpyStore());
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.Request.Headers["X-Account-Service-Key"] = new string('x', 32);
        controller.Request.Headers.Authorization = "Bearer eyJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL3Vua25vd24udGVzdCJ9.";
        var result = Assert.IsType<OkObjectResult>(await controller.Validate(default));
        var json = JsonSerializer.Serialize(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal("{\"valid\":false}", json);
        Assert.Equal(0, handler.Count);
    }

    [Fact]
    public async Task Group_success_returns_group_contract_without_resolving_account()
    {
        using var rsa = RSA.Create(2048);
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, rsa.ExportSubjectPublicKeyInfoPem());
            var legacy = new LegacyGroupsOptions { Enabled = true, Issuer = "legacy", Audience = "gateway", PublicKeyPath = path };
            var payload = new JwtPayload { ["iss"] = "legacy", ["aud"] = "gateway", ["sub"] = "23", ["groupId"] = "23", ["access_level"] = "2", ["exp"] = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds() };
            var header = new JwtHeader(new SigningCredentials(new RsaSecurityKey(rsa), SecurityAlgorithms.RsaSha256));
            header["typ"] = "JWT";
            var token = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(header, payload));
            var store = new SpyStore();
            var handler = new CountingHandler();
            var oidc = new OidcTokenValidator(new OidcOptions { Providers = [new OidcProviderOptions { Issuer = "https://id.test", Audiences = ["account"] }] }, new TestFactory(handler));
            using var legacyValidator = new LegacyGroupTokenValidator(legacy);
            var controller = new ValidationController(new AuthenticationService(legacy, legacyValidator, oidc), store, new InternalServiceKey(new string('x', 32)));
            controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
            controller.Request.Headers["X-Account-Service-Key"] = new string('x', 32);
            controller.Request.Headers.Authorization = "Bearer " + token;
            var result = Assert.IsType<OkObjectResult>(await controller.Validate(default));
            var json = JsonSerializer.Serialize(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            Assert.Equal("{\"valid\":true,\"groupId\":23,\"accessLevel\":2}", json);
            Assert.Equal(0, store.Calls);
            Assert.Equal(0, handler.Count);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Account_runtime_validator_registration_resolves_with_configured_options()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.Configure<OidcOptions>(o => o.Providers = [new OidcProviderOptions { Issuer = "https://issuer.test", Audiences = ["account"] }]);
        services.AddHttpClient("oidc");
        services.AddScoped<OidcTokenValidator>(sp => new(sp.GetRequiredService<IOptions<OidcOptions>>().Value, sp.GetRequiredService<IHttpClientFactory>()));
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        Assert.IsType<OidcTokenValidator>(scope.ServiceProvider.GetRequiredService<OidcTokenValidator>());
    }

    private static ValidationController Make(CountingHandler handler, SpyStore store)
    {
        var factory = new TestFactory(handler);
        var options = new OidcOptions { Providers = [new OidcProviderOptions { Issuer = "https://id.test", Audiences = ["account"] }] };
        var oidc = new OidcTokenValidator(options, factory);
        var legacyOptions = new LegacyGroupsOptions();
        return new ValidationController(new AuthenticationService(legacyOptions, new LegacyGroupTokenValidator(legacyOptions), oidc), store, new InternalServiceKey(new string('x', 32)));
    }

    private sealed class SpyStore : IAccountStore
    {
        public int Calls { get; private set; }
        public Task<int> ResolveOrCreateAsync(VerifiedIdentity identity, CancellationToken cancellationToken) { Calls++; return Task.FromResult(12); }
    }

    private sealed class CountingHandler : HttpMessageHandler
    {
        public int Count { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) { Count++; throw new InvalidOperationException(); }
    }

    private sealed class TestFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, false);
    }
}
