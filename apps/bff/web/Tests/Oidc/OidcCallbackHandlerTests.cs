using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Tdn.Bff.Configuration;
using Tdn.Bff.Oidc;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Oidc;

public sealed class OidcCallbackHandlerTests
{
    [Fact]
    public async Task InvalidStateReturnsGenericUnauthorizedWithoutRedeemingCode()
    {
        var (response, tokenClient) = await RunCallbackAsync("invalid-state");

        AssertCallbackRejected(response);
        Assert.Equal(0, tokenClient.RedeemCount);
    }

    [Fact]
    public async Task MissingCorrelationCookieReturnsGenericUnauthorizedWithoutRedeemingCode()
    {
        var (response, tokenClient) = await RunCallbackAsync(null);

        AssertCallbackRejected(response);
        Assert.Equal(0, tokenClient.RedeemCount);
    }

    private static async Task<(DefaultHttpContext Context, FakeOidcTokenClient TokenClient)> RunCallbackAsync(string? state)
    {
        var tokenClient = new FakeOidcTokenClient();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Bff:Redis:ConnectionString"] = "unused-redis:6379",
            ["Bff:Redis:KeyPrefix"] = "test:bff:",
            ["Oidc:Authority"] = "https://idp.example/realm",
            ["Oidc:ClientId"] = "synthetic-client",
            ["Oidc:ClientSecret"] = "synthetic-secret"
        }).Build();
        var timeProvider = new FixedTimeProvider(DateTimeOffset.UtcNow);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddBffServices(configuration);
        services.AddSingleton<IDataProtectionProvider>(new EphemeralDataProtectionProvider());
        services.AddSingleton<ISessionRepository>(new FakeSessionRepository(timeProvider));
        services.AddSingleton<ILogoutRedirectStore, FakeLogoutRedirectStore>();
        services.AddSingleton<ISessionLock>(new FakeSessionLock());
        services.AddSingleton<IOidcTokenClient>(tokenClient);
        services.Configure<OpenIdConnectOptions>(BffAuthenticationDefaults.Oidc, options =>
        {
            options.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(new OpenIdConnectConfiguration
            {
                Issuer = "https://idp.example/realm",
                AuthorizationEndpoint = "https://idp.example/realm/authorize",
                TokenEndpoint = "https://idp.example/realm/token"
            });
        });
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        context.Request.Scheme = "http";
        context.Request.Host = new HostString("localhost");
        context.Request.Path = "/bff/callback";
        context.Response.Body = new MemoryStream();
        if (state is null)
        {
            var oidcOptions = scope.ServiceProvider.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(BffAuthenticationDefaults.Oidc);
            var properties = new AuthenticationProperties();
            properties.Items[".xsrf"] = "synthetic-correlation-id";
            state = oidcOptions.StateDataFormat!.Protect(properties);
        }
        context.Request.QueryString = new QueryString($"?code=synthetic-code&state={Uri.EscapeDataString(state)}");

        var handlerProvider = scope.ServiceProvider.GetRequiredService<IAuthenticationHandlerProvider>();
        var handler = await handlerProvider.GetHandlerAsync(context, BffAuthenticationDefaults.Oidc);
        var requestHandler = Assert.IsAssignableFrom<IAuthenticationRequestHandler>(handler);
        Assert.True(await requestHandler.HandleRequestAsync());
        return (context, tokenClient);
    }

    private static void AssertCallbackRejected(DefaultHttpContext context)
    {
        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        context.Response.Body.Position = 0;
        using var document = JsonDocument.Parse(context.Response.Body);
        Assert.Equal("authentication_required", document.RootElement.GetProperty("code").GetString());
    }
}
