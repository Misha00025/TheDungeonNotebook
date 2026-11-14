using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Tdn.Bff.Configuration;
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
        Assert.Equal(PathString.Empty, oidc.SignedOutCallbackPath);
        Assert.Equal(OpenIdConnectResponseMode.Query, oidc.ResponseMode);
        Assert.Equal(SameSiteMode.Lax, oidc.CorrelationCookie.SameSite);
        Assert.Equal(CookieSecurePolicy.SameAsRequest, oidc.CorrelationCookie.SecurePolicy);
        Assert.Equal(SameSiteMode.Lax, oidc.NonceCookie.SameSite);
        Assert.Equal(CookieSecurePolicy.SameAsRequest, oidc.NonceCookie.SecurePolicy);
        Assert.Equal(BffAuthenticationDefaults.Cookies, authentication.DefaultAuthenticateScheme);
        Assert.Equal(BffAuthenticationDefaults.Cookies, authentication.DefaultChallengeScheme);
        Assert.Equal(BffAuthenticationDefaults.Cookies, authentication.DefaultForbidScheme);
        Assert.Same(provider.GetRequiredService<ITicketStore>(), cookie.SessionStore);
        Assert.False(cookie.SlidingExpiration);
        Assert.Equal(TimeSpan.FromHours(8), cookie.ExpireTimeSpan);
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
            Endpoints = new EndpointsOptions { Login = "relative", Session = "/has?query", Logout = "/has#fragment" }
        };

        Assert.True(validator.Validate(null, valid).Succeeded);
        Assert.False(validator.Validate(null, invalid).Succeeded);
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
        services.AddSingleton<ISessionLock>(new FakeSessionLock());
        services.AddSingleton<TimeProvider>(timeProvider);
        return services.BuildServiceProvider();
    }
}
