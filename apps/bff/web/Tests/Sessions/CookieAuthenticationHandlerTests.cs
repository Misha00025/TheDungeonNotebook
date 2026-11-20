using System.Security.Claims;
using System.Globalization;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Tdn.Bff.Configuration;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Sessions;

public sealed class CookieAuthenticationHandlerTests
{
    private const string Scheme = BffAuthenticationDefaults.Cookies;

    [Fact]
    public async Task HandlerIssuesPersistentCookieAndRenewsItAndStoredSessionOnAuthenticateResponse()
    {
        var now = new DateTimeOffset(2033, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var repository = new FakeSessionRepository(timeProvider);
        var ticketStore = new RedisTicketStore(repository, new FakeSessionLock(), timeProvider);
        using var services = CreateServices(ticketStore, timeProvider, TimeSpan.FromDays(31));
        var initialContext = CreateContext(services);
        var initialHandler = await CreateHandlerAsync(services, initialContext);
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "subject")], "test"));
        var properties = new AuthenticationProperties();
        properties.StoreTokens(
        [
            new AuthenticationToken { Name = "access_token", Value = "synthetic-access-token" },
            new AuthenticationToken { Name = "refresh_token", Value = "synthetic-refresh-token" }
        ]);

        await initialHandler.SignInAsync(principal, properties);
        await initialHandler.FinishAsync();

        var initialCookie = initialContext.Response.Headers.SetCookie.ToString();
        Assert.Contains("expires=" + (now + TimeSpan.FromDays(31)).ToString("R", CultureInfo.InvariantCulture).ToLowerInvariant(), initialCookie.ToLowerInvariant());
        Assert.DoesNotContain("synthetic-access-token", initialCookie);
        Assert.DoesNotContain("synthetic-refresh-token", initialCookie);
        var sessionKey = Assert.Single(repository.Keys);
        var originalTicket = await repository.GetAsync(sessionKey, CancellationToken.None);
        Assert.True(originalTicket?.Ticket.Properties.IsPersistent);
        Assert.Equal(now + TimeSpan.FromDays(31), originalTicket?.Ticket.Properties.ExpiresUtc);
        Assert.Equal("synthetic-access-token", originalTicket?.Ticket.Properties.GetTokenValue("access_token"));
        Assert.Equal("synthetic-refresh-token", originalTicket?.Ticket.Properties.GetTokenValue("refresh_token"));

        timeProvider.Now = now.AddDays(7);
        var renewalContext = CreateContext(services);
        renewalContext.Request.Headers.Cookie = GetCookiePair(initialCookie);
        var renewalHandler = await CreateHandlerAsync(services, renewalContext);
        var result = await renewalHandler.AuthenticateAsync();
        Assert.True(result.Succeeded);
        await renewalHandler.FinishAsync();

        var renewedCookie = renewalContext.Response.Headers.SetCookie.ToString();
        Assert.Contains("expires=" + (timeProvider.GetUtcNow() + TimeSpan.FromDays(31)).ToString("R", CultureInfo.InvariantCulture).ToLowerInvariant(), renewedCookie.ToLowerInvariant());
        Assert.DoesNotContain("synthetic-access-token", renewedCookie);
        Assert.DoesNotContain("synthetic-refresh-token", renewedCookie);
        var renewedTicket = await repository.GetAsync(sessionKey, CancellationToken.None);
        Assert.Equal(timeProvider.GetUtcNow() + TimeSpan.FromDays(31), renewedTicket?.Ticket.Properties.ExpiresUtc);
        Assert.Equal("subject", renewedTicket?.Ticket.Principal.FindFirst("sub")?.Value);
        Assert.Equal("synthetic-access-token", renewedTicket?.Ticket.Properties.GetTokenValue("access_token"));
        Assert.Equal("synthetic-refresh-token", renewedTicket?.Ticket.Properties.GetTokenValue("refresh_token"));
    }

    private static ServiceProvider CreateServices(ITicketStore ticketStore, TimeProvider timeProvider, TimeSpan lifetime)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        services.AddSingleton(ticketStore);
        services.AddSingleton<ITicketStore>(ticketStore);
        services.AddSingleton<IOptions<BffOptions>>(Options.Create(new BffOptions
        {
            Session = new SessionOptions { Lifetime = lifetime }
        }));
        services.AddSingleton<TimeProvider>(timeProvider);
        services.AddSingleton<IPostConfigureOptions<CookieAuthenticationOptions>, BffCookiePostConfigure>();
        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = Scheme;
                options.DefaultSignInScheme = Scheme;
            })
            .AddCookie(Scheme, options => options.TimeProvider = timeProvider);
        return services.BuildServiceProvider();
    }

    private static DefaultHttpContext CreateContext(IServiceProvider services)
    {
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static async Task<TestCookieAuthenticationHandler> CreateHandlerAsync(IServiceProvider services, DefaultHttpContext context)
    {
        var handler = new TestCookieAuthenticationHandler(
            services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>(),
            services.GetRequiredService<ILoggerFactory>(),
            UrlEncoder.Default);
        var scheme = new AuthenticationScheme(Scheme, Scheme, typeof(TestCookieAuthenticationHandler));
        await handler.InitializeAsync(scheme, context);
        return handler;
    }

    private static string GetCookiePair(string setCookie) => setCookie.Split(';', 2)[0];

    private sealed class TestCookieAuthenticationHandler : CookieAuthenticationHandler
    {
        public TestCookieAuthenticationHandler(IOptionsMonitor<CookieAuthenticationOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        public Task FinishAsync() => base.FinishResponseAsync();
    }
}
