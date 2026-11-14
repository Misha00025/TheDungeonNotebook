using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using Tdn.Bff.Sessions;

namespace Tdn.Bff.Configuration;

public sealed class BffCookiePostConfigure : IPostConfigureOptions<CookieAuthenticationOptions>
{
    private readonly ITicketStore _ticketStore;
    private readonly IOptions<BffOptions> _bffOptions;

    public BffCookiePostConfigure(ITicketStore ticketStore, IOptions<BffOptions> bffOptions)
    {
        _ticketStore = ticketStore;
        _bffOptions = bffOptions;
    }

    public void PostConfigure(string? name, CookieAuthenticationOptions options)
    {
        if (!string.Equals(name, BffAuthenticationDefaults.Cookies, StringComparison.Ordinal))
            return;

        options.SessionStore = _ticketStore;
        options.SlidingExpiration = false;
        options.ExpireTimeSpan = _bffOptions.Value.Session.Lifetime;
        options.Cookie.HttpOnly = true;
        options.Events ??= new CookieAuthenticationEvents();
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
