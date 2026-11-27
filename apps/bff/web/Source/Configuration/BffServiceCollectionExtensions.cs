using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;
using Tdn.Bff.PlayerScreens;
using Tdn.Bff.Security;
using Tdn.Bff.Sessions;
using Tdn.Bff.Upstream;
using Yarp.ReverseProxy.Transforms;

namespace Tdn.Bff.Configuration;

public static class BffServiceCollectionExtensions
{
    public static IServiceCollection AddBffServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
            options.KnownProxies.Clear();
            options.KnownIPNetworks.Clear();
        });

        var bffSection = configuration.GetSection(BffOptions.SectionName);
        services.AddSingleton<IValidateOptions<BffOptions>, BffOptionsValidator>();
        services.AddOptions<BffOptions>()
            .Configure(options =>
            {
                options.Endpoints.LogoutContinuation = "/bff/logout/continue";
                options.Logout.RequestLifetime = TimeSpan.FromMinutes(5);
            })
            .Bind(bffSection)
            .ValidateOnStart();

        var webOptions = bffSection.GetSection("Web").Get<WebOptions>() ?? new WebOptions();
        var exposedHeaders = (bffSection.GetSection("Transport:ResponseHeaders").Get<List<string>>() ?? [])
            .Where(header => !string.Equals(header, "Set-Cookie", StringComparison.OrdinalIgnoreCase))
            .ToArray();
        services.AddCors(options => options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins(webOptions.AllowedOrigins.Select(origin => origin.TrimEnd('/')).ToArray())
                .AllowCredentials()
                .AllowAnyMethod()
                .AllowAnyHeader()
                .WithExposedHeaders(exposedHeaders);
        }));

        var dataProtectionOptions = bffSection.GetSection("DataProtection").Get<DataProtectionOptions>() ?? new DataProtectionOptions();
        var dataProtection = services.AddDataProtection().SetApplicationName(dataProtectionOptions.ApplicationName);
        if (!string.IsNullOrWhiteSpace(dataProtectionOptions.KeyDirectory))
            dataProtection.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionOptions.KeyDirectory));

        services.AddSingleton<IConnectionMultiplexer>(provider =>
            ConnectionMultiplexer.Connect(provider.GetRequiredService<IOptions<BffOptions>>().Value.Redis.ConnectionString));
        services.AddSingleton<ISessionRepository, RedisSessionRepository>();
        services.AddSingleton<ILogoutRedirectStore, RedisLogoutRedirectStore>();
        services.AddSingleton<RedisTicketStore>();
        services.AddSingleton<ITicketStore>(provider => provider.GetRequiredService<RedisTicketStore>());
        services.AddSingleton<ISessionLock, RedisSessionLock>();
        services.AddSingleton<IOidcTokenClient, OidcTokenClient>();
        services.AddSingleton<ISessionTokenService, SessionTokenService>();
        services.AddHttpClient("player-screens");
        services.AddScoped<PlayerScreenService>();
        services.AddSingleton(TimeProvider.System);

        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = BffAuthenticationDefaults.Cookies;
                options.DefaultSignInScheme = BffAuthenticationDefaults.Cookies;
                options.DefaultChallengeScheme = BffAuthenticationDefaults.Cookies;
                options.DefaultForbidScheme = BffAuthenticationDefaults.Cookies;
            })
            .AddCookie(BffAuthenticationDefaults.Cookies)
            .AddOpenIdConnect(BffAuthenticationDefaults.Oidc, _ => { });
        services.AddAuthorization();

        services.AddOptions<OpenIdConnectOptions>(BffAuthenticationDefaults.Oidc)
            .Configure(options =>
            {
                options.SignInScheme = BffAuthenticationDefaults.Cookies;
                options.SignedOutCallbackPath = "/bff/signout-callback";
                options.SignedOutRedirectUri = "/login";
                options.ResponseType = OpenIdConnectResponseType.Code;
                options.ResponseMode = OpenIdConnectResponseMode.Query;
                options.CallbackPath = "/bff/callback";
                options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.CorrelationCookie.SameSite = SameSiteMode.Lax;
                options.NonceCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.NonceCookie.SameSite = SameSiteMode.Lax;
            })
            .Bind(configuration.GetSection("Oidc"));
        services.AddSingleton<IPostConfigureOptions<OpenIdConnectOptions>, BffOpenIdConnectPostConfigure>();

        services.AddOptions<CookieAuthenticationOptions>(BffAuthenticationDefaults.Cookies)
            .Configure(options =>
            {
                options.Cookie.Name = "tdn-session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.Cookie.SameSite = SameSiteMode.Lax;
            })
            .Bind(configuration.GetSection("Cookie"));
        services.AddSingleton<IPostConfigureOptions<CookieAuthenticationOptions>, BffCookiePostConfigure>();

        services.AddAntiforgery();
        services.AddOptions<AntiforgeryOptions>()
            .Configure(options =>
            {
                options.HeaderName = "X-CSRF-TOKEN";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.Cookie.SameSite = SameSiteMode.Strict;
            })
            .Bind(configuration.GetSection("Antiforgery"))
            .PostConfigure(options => options.Cookie.HttpOnly = true);
        services.AddSingleton<IAntiforgeryAdditionalDataProvider, SessionAntiforgeryAdditionalDataProvider>();
        services.AddSingleton<IAntiforgeryRequestValidator, AntiforgeryRequestValidator>();

        services.AddReverseProxy()
            .LoadFromConfig(configuration.GetSection("ReverseProxy"))
            .AddTransforms(GatewayHeaderTransforms.AddTransforms);

        services.AddMvcCore();
        services.AddSingleton<IUrlHelperFactory, UrlHelperFactory>();

        return services;
    }
}
