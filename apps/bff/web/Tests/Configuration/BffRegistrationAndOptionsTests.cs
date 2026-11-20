using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Cors;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Moq;
using Tdn.Bff.Configuration;
using Tdn.Bff.Oidc;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Configuration;

public sealed class BffRegistrationAndOptionsTests
{
    [Fact]
    public async Task NamedAuthenticationOptionsKeepCodePkceAndCookieDefaultsWithoutOidcDefaultChallenge()
    {
        using var provider = CreateProvider(new Dictionary<string, string?>());
        var oidc = provider.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(BffAuthenticationDefaults.Oidc);
        var cookie = provider.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(BffAuthenticationDefaults.Cookies);
        var authentication = provider.GetRequiredService<IOptions<AuthenticationOptions>>().Value;

        Assert.Equal(OpenIdConnectResponseType.Code, oidc.ResponseType);
        Assert.True(oidc.UsePkce);
        Assert.True(oidc.SaveTokens);
        Assert.False(oidc.MapInboundClaims);
        Assert.False(oidc.GetClaimsFromUserInfoEndpoint);
        Assert.False(oidc.UseTokenLifetime);
        Assert.Equal(BffAuthenticationDefaults.Cookies, oidc.SignInScheme);
        Assert.Equal("/bff/callback", oidc.CallbackPath);
        Assert.Equal(PathString.Empty, oidc.RemoteSignOutPath);
        Assert.Equal("/bff/signout-callback", oidc.SignedOutCallbackPath);
        Assert.Equal("/login", oidc.SignedOutRedirectUri);
        Assert.Equal(OpenIdConnectResponseMode.Query, oidc.ResponseMode);
        Assert.Equal(SameSiteMode.Lax, oidc.CorrelationCookie.SameSite);
        Assert.Equal(CookieSecurePolicy.SameAsRequest, oidc.CorrelationCookie.SecurePolicy);
        Assert.Equal(SameSiteMode.Lax, oidc.NonceCookie.SameSite);
        Assert.Equal(CookieSecurePolicy.SameAsRequest, oidc.NonceCookie.SecurePolicy);
        Assert.Equal(BffAuthenticationDefaults.Cookies, authentication.DefaultAuthenticateScheme);
        Assert.Equal(BffAuthenticationDefaults.Cookies, authentication.DefaultChallengeScheme);
        Assert.Equal(BffAuthenticationDefaults.Cookies, authentication.DefaultForbidScheme);
        Assert.Same(provider.GetRequiredService<ITicketStore>(), cookie.SessionStore);
        Assert.True(cookie.SlidingExpiration);
        Assert.Equal(TimeSpan.FromDays(31), cookie.ExpireTimeSpan);
        Assert.True(cookie.Cookie.HttpOnly);
        Assert.Equal("tdn-session", cookie.Cookie.Name);
        Assert.Equal(CookieSecurePolicy.SameAsRequest, cookie.Cookie.SecurePolicy);
        Assert.Equal(SameSiteMode.Lax, cookie.Cookie.SameSite);

        var context = new DefaultHttpContext();
        var scheme = new AuthenticationScheme(BffAuthenticationDefaults.Cookies, BffAuthenticationDefaults.Cookies, typeof(CookieAuthenticationHandler));
        var redirectContext = new RedirectContext<CookieAuthenticationOptions>(context, scheme, cookie, new AuthenticationProperties(), "/login");
        await cookie.Events.OnRedirectToLogin(redirectContext);
        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
    }

    [Fact]
    public async Task CookieEventsMakeTicketsPersistentAndRenewOldTicketsWithConfiguredDuration()
    {
        var now = new DateTimeOffset(2031, 4, 5, 6, 7, 8, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var ticketStore = new Mock<ITicketStore>();
        var options = new CookieAuthenticationOptions();
        var lifetime = TimeSpan.FromDays(45);
        new BffCookiePostConfigure(ticketStore.Object, Options.Create(new BffOptions
        {
            Session = new SessionOptions { Lifetime = lifetime }
        }), timeProvider).PostConfigure(BffAuthenticationDefaults.Cookies, options);
        var scheme = new AuthenticationScheme(BffAuthenticationDefaults.Cookies, BffAuthenticationDefaults.Cookies, typeof(CookieAuthenticationHandler));
        var context = new DefaultHttpContext();
        var principal = new ClaimsPrincipal(new ClaimsIdentity("test"));
        var signingInProperties = new AuthenticationProperties();
        var signingIn = new CookieSigningInContext(context, scheme, options, principal, signingInProperties, new CookieOptions());

        await options.Events.OnSigningIn(signingIn);

        Assert.True(signingInProperties.IsPersistent);
        Assert.Equal(now, signingInProperties.IssuedUtc);
        Assert.Equal(now + lifetime, signingInProperties.ExpiresUtc);

        var oldIssued = now.AddHours(-1);
        var oldProperties = new AuthenticationProperties { IssuedUtc = oldIssued, ExpiresUtc = oldIssued.AddHours(8) };
        var ticket = new AuthenticationTicket(principal, oldProperties, BffAuthenticationDefaults.Cookies);
        var sliding = new CookieSlidingExpirationContext(context, scheme, options, ticket, TimeSpan.FromHours(1), TimeSpan.FromHours(7));

        await options.Events.OnCheckSlidingExpiration(sliding);

        Assert.True(sliding.ShouldRenew);
        Assert.True(sliding.Properties.IsPersistent);
        Assert.Equal(oldIssued + lifetime, sliding.Properties.ExpiresUtc);
    }

    [Fact]
    public async Task CookieSignInUsesConfiguredIssuedTimeForPersistentExpiry()
    {
        var now = new DateTimeOffset(2031, 4, 5, 6, 7, 8, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var ticketStore = new Mock<ITicketStore>();
        var options = new CookieAuthenticationOptions();
        var issued = now.AddMinutes(-3);
        var lifetime = TimeSpan.FromDays(12);
        new BffCookiePostConfigure(ticketStore.Object, Options.Create(new BffOptions
        {
            Session = new SessionOptions { Lifetime = lifetime }
        }), timeProvider).PostConfigure(BffAuthenticationDefaults.Cookies, options);
        var scheme = new AuthenticationScheme(BffAuthenticationDefaults.Cookies, BffAuthenticationDefaults.Cookies, typeof(CookieAuthenticationHandler));
        var properties = new AuthenticationProperties { IssuedUtc = issued };

        await options.Events.OnSigningIn(new CookieSigningInContext(new DefaultHttpContext(), scheme, options,
            new ClaimsPrincipal(new ClaimsIdentity("test")), properties, new CookieOptions()));

        Assert.True(properties.IsPersistent);
        Assert.Equal(issued, properties.IssuedUtc);
        Assert.Equal(issued + lifetime, properties.ExpiresUtc);
    }

    [Fact]
    public void OidcCorrelationAndNonceCookiesAcceptHttpsFormPostOverrides()
    {
        using var provider = CreateProvider(new Dictionary<string, string?>
        {
            ["Oidc:ResponseMode"] = "form_post",
            ["Oidc:CorrelationCookie:SameSite"] = "None",
            ["Oidc:CorrelationCookie:SecurePolicy"] = "Always",
            ["Oidc:NonceCookie:SameSite"] = "None",
            ["Oidc:NonceCookie:SecurePolicy"] = "Always",
            ["Cookie:Cookie:SecurePolicy"] = "Always"
        });
        var oidc = provider.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(BffAuthenticationDefaults.Oidc);
        var cookie = provider.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(BffAuthenticationDefaults.Cookies);

        Assert.Equal(OpenIdConnectResponseMode.FormPost, oidc.ResponseMode);
        Assert.Equal(SameSiteMode.None, oidc.CorrelationCookie.SameSite);
        Assert.Equal(CookieSecurePolicy.Always, oidc.CorrelationCookie.SecurePolicy);
        Assert.Equal(SameSiteMode.None, oidc.NonceCookie.SameSite);
        Assert.Equal(CookieSecurePolicy.Always, oidc.NonceCookie.SecurePolicy);
        Assert.Equal(CookieSecurePolicy.Always, cookie.Cookie.SecurePolicy);
        Assert.True(cookie.Cookie.HttpOnly);
    }

    [Fact]
    public void OptionsValidatorAcceptsLargeDurationsAndRejectsInvalidPathsAndDurations()
    {
        var validator = new BffOptionsValidator();
        var valid = new BffOptions
        {
            Redis = new RedisOptions { ConnectionString = "redis", KeyPrefix = "prefix:" },
            Session = new SessionOptions
            {
                Lifetime = TimeSpan.FromDays(1000),
                RefreshBeforeExpiry = TimeSpan.Zero,
                LockWaitTimeout = TimeSpan.FromDays(50),
                LockExpiry = TimeSpan.FromDays(10),
                LockExtensionCadence = TimeSpan.FromDays(1)
            }
        };
        var invalid = new BffOptions
        {
            Redis = new RedisOptions { ConnectionString = "redis", KeyPrefix = "prefix:" },
            Session = new SessionOptions { Lifetime = TimeSpan.Zero },
            Endpoints = new EndpointsOptions { Login = "relative", Session = "/has?query", Logout = "/has#fragment", LogoutContinuation = "//host/path" },
            Logout = new LogoutOptions { RequestLifetime = TimeSpan.Zero }
        };

        Assert.True(validator.Validate(null, valid).Succeeded);
        Assert.False(validator.Validate(null, invalid).Succeeded);
    }

    [Fact]
    public void MissingLogoutSettingsUseDefaultsAndConfiguredValuesAreBound()
    {
        using var defaults = CreateProvider(new Dictionary<string, string?>());
        var defaultOptions = defaults.GetRequiredService<IOptions<BffOptions>>().Value;
        Assert.Equal("/bff/logout/continue", defaultOptions.Endpoints.LogoutContinuation);
        Assert.Equal(TimeSpan.FromMinutes(5), defaultOptions.Logout.RequestLifetime);

        using var configured = CreateProvider(new Dictionary<string, string?>
        {
            ["Bff:Endpoints:LogoutContinuation"] = "/custom/logout",
            ["Bff:Logout:RequestLifetime"] = "00:02:00",
            ["Oidc:SignedOutCallbackPath"] = "/custom/callback",
            ["Oidc:SignedOutRedirectUri"] = "https://web.example/logout"
        });
        var options = configured.GetRequiredService<IOptions<BffOptions>>().Value;
        var oidc = configured.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(BffAuthenticationDefaults.Oidc);
        Assert.Equal("/custom/logout", options.Endpoints.LogoutContinuation);
        Assert.Equal(TimeSpan.FromMinutes(2), options.Logout.RequestLifetime);
        Assert.Equal("/custom/callback", oidc.SignedOutCallbackPath);
        Assert.Equal("https://web.example/logout", oidc.SignedOutRedirectUri);
    }

    [Fact]
    public void OptionsValidatorAcceptsExactHttpOriginsAndRejectsNonOrigins()
    {
        var validator = new BffOptionsValidator();
        var valid = new BffOptions
        {
            Redis = new RedisOptions { ConnectionString = "redis", KeyPrefix = "prefix:" },
            Web = new WebOptions { PublicOrigin = "http://hub.example:8081/", AllowedOrigins = ["https://web.example:9443", "http://localhost:5173/"] }
        };
        Assert.True(validator.Validate(null, valid).Succeeded);

        foreach (var origin in new[] { "*", "https://user:password@example.com", "https://example.com/path", "https://example.com?x=1", "https://example.com#fragment" })
        {
            var invalid = new BffOptions
            {
                Redis = new RedisOptions { ConnectionString = "redis", KeyPrefix = "prefix:" },
                Web = new WebOptions { AllowedOrigins = [origin] }
            };
            Assert.False(validator.Validate(null, invalid).Succeeded);
        }
    }

    [Fact]
    public void CorsDefaultPolicyAllowsConfiguredCredentialedOriginAndExposesTransportHeaders()
    {
        using var provider = CreateCorsProvider("https://web.example/");
        var cors = provider.GetRequiredService<ICorsService>();
        var corsOptions = provider.GetRequiredService<IOptions<CorsOptions>>().Value;
        var policy = corsOptions.GetPolicy(corsOptions.DefaultPolicyName)!;
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Options;
        context.Request.Headers.Origin = "https://web.example";
        context.Request.Headers.AccessControlRequestMethod = "POST";
        context.Request.Headers.AccessControlRequestHeaders = "X-CSRF-TOKEN, Content-Type";

        var result = cors.EvaluatePolicy(context, policy);

        Assert.True(result.IsPreflightRequest);
        Assert.True(result.SupportsCredentials);
        Assert.Equal("https://web.example", result.AllowedOrigin);
        Assert.Contains("X-CSRF-TOKEN", result.AllowedHeaders);
        Assert.Contains("Content-Disposition", result.AllowedExposedHeaders);
        Assert.Contains("ETag", result.AllowedExposedHeaders);
        Assert.DoesNotContain(result.AllowedExposedHeaders, header => string.Equals(header, "Set-Cookie", StringComparison.OrdinalIgnoreCase));

        context.Request.Headers.Origin = "https://unknown.example";
        result = cors.EvaluatePolicy(context, policy);
        Assert.False(result.IsOriginAllowed);
    }

    [Fact]
    public async Task CorsMiddlewareHandlesAllowedPreflightWithoutCallingNext()
    {
        using var provider = CreateCorsProvider("https://web.example/");
        var nextCalled = false;
        var middleware = new CorsMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            provider.GetRequiredService<ICorsService>(),
            provider.GetRequiredService<ILoggerFactory>());
        var context = CreatePreflightContext("https://web.example");

        await middleware.Invoke(context, provider.GetRequiredService<ICorsPolicyProvider>());

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status204NoContent, context.Response.StatusCode);
        Assert.Equal("https://web.example", context.Response.Headers.AccessControlAllowOrigin.ToString());
        Assert.Equal("true", context.Response.Headers.AccessControlAllowCredentials.ToString());
        Assert.Contains("X-CSRF-TOKEN", context.Response.Headers.AccessControlAllowHeaders.ToString().Split(',').Select(header => header.Trim()), StringComparer.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("https://unknown.example", "https://web.example")]
    [InlineData("https://web.example", "")]
    public async Task CorsMiddlewareDoesNotAllowUnknownOrUnconfiguredOrigins(string requestOrigin, string configuredOrigin)
    {
        using var provider = CreateCorsProvider(configuredOrigin);
        var nextCalled = false;
        var middleware = new CorsMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            provider.GetRequiredService<ICorsService>(),
            provider.GetRequiredService<ILoggerFactory>());
        var context = CreatePreflightContext(requestOrigin);

        await middleware.Invoke(context, provider.GetRequiredService<ICorsPolicyProvider>());

        Assert.False(nextCalled);
        Assert.False(context.Response.Headers.ContainsKey("Access-Control-Allow-Origin"));
        Assert.False(context.Response.Headers.ContainsKey("Access-Control-Allow-Credentials"));
    }

    private static ServiceProvider CreateCorsProvider(string configuredOrigin)
    {
        var values = new Dictionary<string, string?>
        {
            ["Bff:Redis:ConnectionString"] = "unused-redis:6379",
            ["Bff:Transport:ResponseHeaders:0"] = "Content-Disposition",
            ["Bff:Transport:ResponseHeaders:1"] = "ETag",
            ["Bff:Transport:ResponseHeaders:2"] = "Set-Cookie"
        };
        if (!string.IsNullOrEmpty(configuredOrigin))
            values["Bff:Web:AllowedOrigins:0"] = configuredOrigin;
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddBffServices(configuration);
        return services.BuildServiceProvider();
    }

    private static DefaultHttpContext CreatePreflightContext(string origin)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Options;
        context.Request.Headers.Origin = origin;
        context.Request.Headers.AccessControlRequestMethod = HttpMethods.Post;
        context.Request.Headers.AccessControlRequestHeaders = "X-CSRF-TOKEN, Content-Type";
        return context;
    }

    private static ServiceProvider CreateProvider(IDictionary<string, string?> overrides)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["Bff:Redis:ConnectionString"] = "unused-redis:6379",
            ["Bff:Redis:KeyPrefix"] = "test:bff:",
            ["Oidc:Authority"] = "https://idp.example/realm",
            ["Oidc:ClientId"] = "synthetic-client",
            ["Oidc:ClientSecret"] = "synthetic-secret"
        };
        foreach (var pair in overrides)
            values[pair.Key] = pair.Value;
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var timeProvider = new FixedTimeProvider(DateTimeOffset.UtcNow);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddBffServices(configuration);
        services.AddSingleton<ISessionRepository>(new FakeSessionRepository(timeProvider));
        services.AddSingleton<ILogoutRedirectStore, FakeLogoutRedirectStore>();
        services.AddSingleton<ISessionLock>(new FakeSessionLock());
        services.AddSingleton<TimeProvider>(timeProvider);
        return services.BuildServiceProvider();
    }
}
