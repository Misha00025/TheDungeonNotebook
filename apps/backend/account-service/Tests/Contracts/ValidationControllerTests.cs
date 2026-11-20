using System.Text.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Tdn.Accounts.Configuration;
using Tdn.Accounts.Controllers;
using Tdn.Accounts.Persistence;
using Tdn.Accounts.Security;
using Xunit;

namespace Tdn.Accounts.Tests.Contracts;

public sealed class ValidationControllerTests : IDisposable
{
    private readonly MemoryCache cache = new(new MemoryCacheOptions());

    public void Dispose() => cache.Dispose();

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
            var oidc = new OidcTokenValidator(new OidcOptions { Providers = [new OidcProviderOptions { Issuer = "https://id.test", Audiences = ["account"] }] }, new TestFactory(handler), cache, TimeProvider.System);
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
        services.AddMemoryCache();
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<OidcTokenValidator>(sp => new(sp.GetRequiredService<IOptions<OidcOptions>>().Value, sp.GetRequiredService<IHttpClientFactory>(), sp.GetRequiredService<IMemoryCache>(), sp.GetRequiredService<TimeProvider>()));
        using var provider = services.BuildServiceProvider();
        using var firstScope = provider.CreateScope();
        using var secondScope = provider.CreateScope();
        var first = firstScope.ServiceProvider.GetRequiredService<OidcTokenValidator>();
        var second = secondScope.ServiceProvider.GetRequiredService<OidcTokenValidator>();
        Assert.Same(first, second);
    }

    [Fact]
    public async Task Successful_cached_identity_still_resolves_account_and_preserves_http_contract()
    {
        using var rsa = RSA.Create(2048);
        var key = new RsaSecurityKey(rsa) { KeyId = "key1" };
        var handler = new OidcHandler(key);
        var store = new SpyStore();
        var options = new OidcOptions { Providers = [new OidcProviderOptions { Issuer = "https://id.test", Audiences = ["account"] }] };
        var oidc = new OidcTokenValidator(options, new TestFactory(handler), cache, TimeProvider.System);
        var legacy = new LegacyGroupsOptions();
        var controller = new ValidationController(new AuthenticationService(legacy, new LegacyGroupTokenValidator(legacy), oidc), store, new InternalServiceKey(new string('x', 32)));
        var token = CreateToken(key);

        foreach (var _ in Enumerable.Range(0, 2))
        {
            controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
            controller.Request.Headers["X-Account-Service-Key"] = new string('x', 32);
            controller.Request.Headers.Authorization = "Bearer " + token;
            var result = Assert.IsType<OkObjectResult>(await controller.Validate(default));
            var json = JsonSerializer.Serialize(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            Assert.Equal("{\"valid\":true,\"accountId\":12}", json);
            Assert.Equal("no-store", controller.Response.Headers.CacheControl);
        }

        Assert.Equal(2, store.Calls);
        Assert.Equal(2, handler.Count);
    }

    private ValidationController Make(CountingHandler handler, SpyStore store)
    {
        var factory = new TestFactory(handler);
        var options = new OidcOptions { Providers = [new OidcProviderOptions { Issuer = "https://id.test", Audiences = ["account"] }] };
        var oidc = new OidcTokenValidator(options, factory, cache, TimeProvider.System);
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

    private sealed class OidcHandler(SecurityKey key) : HttpMessageHandler
    {
        private int count;
        public int Count => Volatile.Read(ref count);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref count);
            var content = request.RequestUri!.AbsolutePath.EndsWith("jwks", StringComparison.Ordinal)
                ? JsonSerializer.Serialize(new { keys = new[] { new { kty = "RSA", kid = key.KeyId, use = "sig", alg = "RS256", n = Base64UrlEncoder.Encode(((RSA)((RsaSecurityKey)key).Rsa!).ExportParameters(false).Modulus!), e = Base64UrlEncoder.Encode(((RSA)((RsaSecurityKey)key).Rsa!).ExportParameters(false).Exponent!) } } })
                : JsonSerializer.Serialize(new { issuer = "https://id.test", jwks_uri = "https://id.test/jwks" });
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(content, System.Text.Encoding.UTF8, "application/json") });
        }
    }

    private static string CreateToken(SecurityKey key)
    {
        var payload = new JwtPayload { ["iss"] = "https://id.test", ["sub"] = "subject", ["aud"] = "account", ["exp"] = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds() };
        var header = new JwtHeader(new SigningCredentials(key, SecurityAlgorithms.RsaSha256)) { ["typ"] = "at+jwt" };
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(header, payload));
    }

    private sealed class TestFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, false);
    }
}
