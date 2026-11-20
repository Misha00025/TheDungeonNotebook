using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using Tdn.Bff.Sessions;

namespace Tdn.Bff.Configuration;

public sealed class BffCookiePostConfigure : IPostConfigureOptions<CookieAuthenticationOptions>
{
    private readonly ITicketStore _ticketStore;
    private readonly IOptions<BffOptions> _bffOptions;
    private readonly TimeProvider _timeProvider;

    public BffCookiePostConfigure(ITicketStore ticketStore, IOptions<BffOptions> bffOptions, TimeProvider timeProvider)
    {
        _ticketStore = ticketStore;
        _bffOptions = bffOptions;
        _timeProvider = timeProvider;
    }

    public void PostConfigure(string? name, CookieAuthenticationOptions options)
    {
        if (!string.Equals(name, BffAuthenticationDefaults.Cookies, StringComparison.Ordinal))
            return;

        options.SessionStore = _ticketStore;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = _bffOptions.Value.Session.Lifetime;
        options.Cookie.HttpOnly = true;
        options.Events ??= new CookieAuthenticationEvents();
        options.Events.OnSigningIn = context =>
        {
            var issuedUtc = context.Properties.IssuedUtc ?? _timeProvider.GetUtcNow();
            context.Properties.IssuedUtc = issuedUtc;
            context.Properties.ExpiresUtc = issuedUtc + _bffOptions.Value.Session.Lifetime;
            context.Properties.IsPersistent = true;
            return Task.CompletedTask;
        };
        options.Events.OnCheckSlidingExpiration = context =>
        {
            context.ShouldRenew = true;
            context.Properties.IsPersistent = true;
            var issuedUtc = context.Properties.IssuedUtc ?? _timeProvider.GetUtcNow();
            context.Properties.IssuedUtc = issuedUtc;
            context.Properties.ExpiresUtc = issuedUtc + _bffOptions.Value.Session.Lifetime;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.Headers.CacheControl = "no-store";
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.Headers.CacheControl = "no-store";
            return Task.CompletedTask;
        };
    }
}
