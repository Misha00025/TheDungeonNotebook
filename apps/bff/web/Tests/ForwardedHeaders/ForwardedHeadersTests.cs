using System.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Tdn.Bff.Configuration;
using Tdn.Bff.Oidc;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.ForwardedHeaders;

public sealed class ForwardedHeadersTests
{
    [Fact]
    public async Task ForwardedHttpsProducesHttpsOidcCallback()
    {
        var location = await ChallengeAsync("https");

        Assert.Equal("https://bff.example.test/bff/callback", QueryHelpers.ParseQuery(new Uri(location).Query)["redirect_uri"].ToString());
    }

    [Fact]
    public async Task HttpWithoutForwardedProtoKeepsHttpOidcCallback()
    {
        var location = await ChallengeAsync(null);

        Assert.Equal("http://bff.example.test/bff/callback", QueryHelpers.ParseQuery(new Uri(location).Query)["redirect_uri"].ToString());
    }

    private static async Task<string> ChallengeAsync(string? forwardedProto)
    {
        var values = new Dictionary<string, string?>
        {
            ["Bff:Redis:ConnectionString"] = "unused-redis:6379",
            ["Bff:Redis:KeyPrefix"] = "test:bff:",
            ["Oidc:Authority"] = "https://idp.example/realm",
            ["Oidc:ClientId"] = "synthetic-client",
            ["Oidc:ClientSecret"] = "synthetic-secret"
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var timeProvider = new FixedTimeProvider(DateTimeOffset.UtcNow);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddBffServices(configuration);
        services.AddSingleton<IDataProtectionProvider>(new EphemeralDataProtectionProvider());
        services.AddSingleton<ISessionRepository>(new FakeSessionRepository(timeProvider));
        services.AddSingleton<ISessionLock>(new FakeSessionLock());
        services.AddSingleton<IOidcTokenClient>(new FakeOidcTokenClient());
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
        context.Request.Host = new HostString("bff.example.test");
        context.Request.Path = "/bff/login";
        context.Connection.RemoteIpAddress = IPAddress.Parse("192.0.2.10");
        if (forwardedProto is not null)
            context.Request.Headers["X-Forwarded-Proto"] = forwardedProto;
        context.Response.Body = new MemoryStream();

        var middleware = new ForwardedHeadersMiddleware(
            async requestContext => await requestContext.ChallengeAsync(
                BffAuthenticationDefaults.Oidc,
                new AuthenticationProperties { RedirectUri = "/bff/session" }),
            scope.ServiceProvider.GetRequiredService<ILoggerFactory>(),
            scope.ServiceProvider.GetRequiredService<IOptions<ForwardedHeadersOptions>>());
        await middleware.Invoke(context);

        return context.Response.Headers.Location.ToString();
    }
}
