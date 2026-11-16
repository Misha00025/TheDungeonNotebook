using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Tdn.Bff.Configuration;
using Tdn.Bff.Endpoints;
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;
using Tdn.Bff.Security;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Oidc;

public sealed class OidcLogoutHandlerTests
{
    [Fact]
    public async Task LogoutClearsLocalSessionAndReturnsOpaqueUrlThenContinuationRedirectsToProviderAndCallbackReturnsToWeb()
    {
        using var fixture = CreateFixture("https://idp.example/realm/logout");
        var cookie = await fixture.CreateSessionCookieAsync();
        var context = await fixture.CreateRequestAsync("/bff/logout", cookie);
        var authentication = await context.AuthenticateAsync(BffAuthenticationDefaults.Cookies);
        Assert.True(authentication.Succeeded);
        context.User = authentication.Principal!;
        var sessionKey = context.User.FindFirst(BffAuthenticationDefaults.SessionClaim)!.Value;

        await BffEndpointRouteBuilderExtensions.HandleLogoutAsync(context, new PassAntiforgeryValidator(), "/login", "https://web.example");

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.Contains(context.Response.Headers.SetCookie, value => value is not null && (value.Contains("expires=", StringComparison.OrdinalIgnoreCase) || value.Contains("max-age=0", StringComparison.OrdinalIgnoreCase)));
        Assert.Null(await fixture.Repository.GetAsync(sessionKey, CancellationToken.None));
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body);
        var logoutUrl = json.RootElement.GetProperty("logoutUrl").GetString()!;
        Assert.StartsWith("https://bff.example/bff/logout/continue?request=", logoutUrl);
        Assert.DoesNotContain("idp.example", logoutUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("id_token", logoutUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("access_token", logoutUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("refresh_token", logoutUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("synthetic-id-token", logoutUrl);
        Assert.DoesNotContain("synthetic-access-token", logoutUrl);
        Assert.DoesNotContain("synthetic-refresh-token", logoutUrl);

        var continuation = await fixture.CreateRequestAsync(new Uri(logoutUrl).PathAndQuery, null);
        await BffEndpointRouteBuilderExtensions.HandleLogoutContinuationAsync(continuation, fixture.Store);

        Assert.Equal(StatusCodes.Status302Found, continuation.Response.StatusCode);
        var providerUrl = new Uri(continuation.Response.Headers.Location!);
        var providerQuery = QueryHelpers.ParseQuery(providerUrl.Query);
        Assert.Equal("https://idp.example/realm/logout", $"{providerUrl.Scheme}://{providerUrl.Host}{providerUrl.AbsolutePath}");
        Assert.Equal("synthetic-id-token", providerQuery["id_token_hint"]);
        Assert.Equal("synthetic-client", providerQuery["client_id"]);
        Assert.Equal("https://bff.example/bff/signout-callback", providerQuery["post_logout_redirect_uri"]);
        Assert.DoesNotContain("https://web.example/login", continuation.Response.Headers.Location.ToString());
        Assert.False(string.IsNullOrWhiteSpace(providerQuery["state"]));

        var replay = await fixture.CreateRequestAsync(new Uri(logoutUrl).PathAndQuery, null);
        await BffEndpointRouteBuilderExtensions.HandleLogoutContinuationAsync(replay, fixture.Store);
        Assert.Equal(StatusCodes.Status400BadRequest, replay.Response.StatusCode);

        var callback = await fixture.HandleCallbackAsync(providerQuery["state"]!);
        Assert.Equal(StatusCodes.Status302Found, callback.Response.StatusCode);
        Assert.Equal("https://web.example/login", callback.Response.Headers.Location);
    }

    [Fact]
    public async Task LogoutHonorsConfiguredCallbackAndAbsoluteSignedOutTarget()
    {
        using var fixture = CreateFixture("https://idp.example/realm/logout", "/custom/signout", "https://web.example/custom-complete");
        var cookie = await fixture.CreateSessionCookieAsync();
        var context = await fixture.CreateRequestAsync("/bff/logout", cookie);
        var authentication = await context.AuthenticateAsync(BffAuthenticationDefaults.Cookies);
        Assert.True(authentication.Succeeded);
        context.User = authentication.Principal!;

        await BffEndpointRouteBuilderExtensions.HandleLogoutAsync(context, new PassAntiforgeryValidator(), fixture.SignedOutRedirectUri, "https://ignored.example");

        context.Response.Body.Position = 0;
        var json = await JsonDocument.ParseAsync(context.Response.Body);
        var logoutUrl = json.RootElement.GetProperty("logoutUrl").GetString()!;
        var continuation = await fixture.CreateRequestAsync(new Uri(logoutUrl).PathAndQuery, null);
        await BffEndpointRouteBuilderExtensions.HandleLogoutContinuationAsync(continuation, fixture.Store);
        var query = QueryHelpers.ParseQuery(new Uri(continuation.Response.Headers.Location!).Query);
        Assert.Equal("https://bff.example/custom/signout", query["post_logout_redirect_uri"]);
        Assert.DoesNotContain("https://web.example/custom-complete", continuation.Response.Headers.Location.ToString());

        var callback = await fixture.HandleCallbackAsync(query["state"]!, "/custom/signout");
        Assert.Equal("https://web.example/custom-complete", callback.Response.Headers.Location);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("tampered-state")]
    public async Task MissingOrInvalidStateReturnsBadRequest(string? state)
    {
        using var fixture = CreateFixture("https://idp.example/realm/logout");

        var callback = await fixture.HandleCallbackAsync(state);

        Assert.Equal(StatusCodes.Status400BadRequest, callback.Response.StatusCode);
        Assert.Equal("no-store", callback.Response.Headers.CacheControl);
        callback.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(callback.Response.Body);
        Assert.Equal("invalid_logout_state", json.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task MissingEndSessionEndpointFailsAfterLocalSessionRemoval()
    {
        using var fixture = CreateFixture(null);
        var cookie = await fixture.CreateSessionCookieAsync();
        var context = await fixture.CreateRequestAsync("/bff/logout", cookie);
        var authentication = await context.AuthenticateAsync(BffAuthenticationDefaults.Cookies);
        context.User = authentication.Principal!;
        var sessionKey = context.User.FindFirst(BffAuthenticationDefaults.SessionClaim)!.Value;

        await Assert.ThrowsAsync<DependencyUnavailableException>(() => BffEndpointRouteBuilderExtensions.HandleLogoutAsync(context, new PassAntiforgeryValidator(), "/login", "https://web.example"));

        Assert.Contains(context.Response.Headers.SetCookie, value => value is not null && (value.Contains("expires=", StringComparison.OrdinalIgnoreCase) || value.Contains("max-age=0", StringComparison.OrdinalIgnoreCase)));
        Assert.Null(await fixture.Repository.GetAsync(sessionKey, CancellationToken.None));
        Assert.DoesNotContain("logoutUrl", await ReadBodyAsync(context));
    }

    private static Fixture CreateFixture(string? endSessionEndpoint, string callbackPath = "/bff/signout-callback", string signedOutRedirectUri = "/login")
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Bff:Redis:ConnectionString"] = "unused-redis:6379",
            ["Bff:Redis:KeyPrefix"] = "test:bff:",
            ["Bff:Web:PublicOrigin"] = "https://bff.example",
            ["Oidc:Authority"] = "https://idp.example/realm",
            ["Oidc:ClientId"] = "synthetic-client",
            ["Oidc:ClientSecret"] = "synthetic-secret",
            ["Oidc:SignedOutCallbackPath"] = callbackPath,
            ["Oidc:SignedOutRedirectUri"] = signedOutRedirectUri
        }).Build();
        var timeProvider = new FixedTimeProvider(DateTimeOffset.UtcNow);
        var repository = new FakeSessionRepository(timeProvider);
        var store = new FakeLogoutRedirectStore();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddBffServices(configuration);
        services.AddSingleton<IDataProtectionProvider>(new EphemeralDataProtectionProvider());
        services.AddSingleton<ISessionRepository>(repository);
        services.AddSingleton<ISessionLock>(new FakeSessionLock());
        services.AddSingleton<IOidcTokenClient>(new FakeOidcTokenClient());
        services.AddSingleton<ILogoutRedirectStore>(store);
        var oidcConfiguration = new OpenIdConnectConfiguration
        {
            Issuer = "https://idp.example/realm",
            AuthorizationEndpoint = "https://idp.example/realm/authorize",
            TokenEndpoint = "https://idp.example/realm/token",
            EndSessionEndpoint = endSessionEndpoint
        };
        services.Configure<OpenIdConnectOptions>(BffAuthenticationDefaults.Oidc, options =>
            options.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(oidcConfiguration));
        return new Fixture(services.BuildServiceProvider(), repository, store, signedOutRedirectUri);
    }

    private static async Task<string> ReadBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        return await reader.ReadToEndAsync();
    }

    private sealed class Fixture : IDisposable
    {
        private readonly ServiceProvider _provider;
        private readonly List<AsyncServiceScope> _scopes = [];

        public Fixture(ServiceProvider provider, FakeSessionRepository repository, FakeLogoutRedirectStore store, string signedOutRedirectUri)
        {
            _provider = provider;
            Repository = repository;
            Store = store;
            SignedOutRedirectUri = signedOutRedirectUri;
        }

        public FakeSessionRepository Repository { get; }
        public FakeLogoutRedirectStore Store { get; }
        public string SignedOutRedirectUri { get; }

        public async Task<string> CreateSessionCookieAsync()
        {
            await using var scope = _provider.CreateAsyncScope();
            var context = NewContext(scope.ServiceProvider, "/seed");
            var identity = new ClaimsIdentity("test");
            identity.AddClaim(new Claim("sub", "synthetic-subject"));
            var properties = new AuthenticationProperties { ExpiresUtc = DateTimeOffset.UtcNow.AddHours(1) };
            properties.StoreTokens(new[]
            {
                new AuthenticationToken { Name = "access_token", Value = "synthetic-access-token" },
                new AuthenticationToken { Name = "refresh_token", Value = "synthetic-refresh-token" },
                new AuthenticationToken { Name = "id_token", Value = "synthetic-id-token" }
            });
            await context.SignInAsync(BffAuthenticationDefaults.Cookies, new ClaimsPrincipal(identity), properties);
            var setCookie = context.Response.Headers.SetCookie.ToString();
            var first = setCookie.Split(';', 2)[0];
            return first[(first.IndexOf('=') + 1)..];
        }

        public Task<DefaultHttpContext> CreateRequestAsync(string pathAndQuery, string? cookie)
        {
            var scope = _provider.CreateAsyncScope();
            _scopes.Add(scope);
            var context = NewContext(scope.ServiceProvider, new Uri("https://bff.example" + pathAndQuery).AbsolutePath);
            context.Request.QueryString = new QueryString(new Uri("https://bff.example" + pathAndQuery).Query);
            if (cookie is not null)
                context.Request.Headers.Cookie = $"tdn-session={cookie}";
            return Task.FromResult(context);
        }

        public async Task<DefaultHttpContext> HandleCallbackAsync(string? state, string? callbackPath = null)
        {
            var context = await CreateRequestAsync(callbackPath ?? "/bff/signout-callback", null);
            if (state is not null)
                context.Request.QueryString = new QueryString($"?state={Uri.EscapeDataString(state)}");
            var handler = await context.RequestServices.GetRequiredService<IAuthenticationHandlerProvider>().GetHandlerAsync(context, BffAuthenticationDefaults.Oidc);
            var requestHandler = Assert.IsAssignableFrom<IAuthenticationRequestHandler>(handler);
            Assert.True(await requestHandler.HandleRequestAsync());
            return context;
        }

        public void Dispose()
        {
            foreach (var scope in _scopes)
                scope.Dispose();
            _provider.Dispose();
        }

        private static DefaultHttpContext NewContext(IServiceProvider services, string path)
        {
            var context = new DefaultHttpContext { RequestServices = services };
            context.Request.Scheme = "https";
            context.Request.Host = new HostString("bff.example");
            context.Request.Path = path;
            context.Response.Body = new MemoryStream();
            return context;
        }
    }

    private sealed class PassAntiforgeryValidator : IAntiforgeryRequestValidator
    {
        public Task ValidateUnsafeRequestAsync(HttpContext context) => Task.CompletedTask;
    }
}
