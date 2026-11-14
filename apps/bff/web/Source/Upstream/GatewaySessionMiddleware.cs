using Tdn.Bff.Errors;
using Tdn.Bff.Security;
using Tdn.Bff.Sessions;

namespace Tdn.Bff.Upstream;

public sealed class GatewaySessionMiddleware
{
    private static readonly object AccessTokenItemKey = new();
    private readonly RequestDelegate _next;

    public GatewaySessionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IAntiforgeryRequestValidator antiforgeryValidator, ISessionTokenService sessionTokenService)
    {
        var sessionKey = context.User.FindFirst(BffAuthenticationDefaults.SessionClaim)?.Value;
        if (context.User.Identity?.IsAuthenticated != true || string.IsNullOrEmpty(sessionKey))
            throw new AuthenticationRequiredException();

        await antiforgeryValidator.ValidateUnsafeRequestAsync(context).ConfigureAwait(false);
        var accessToken = await sessionTokenService.GetAccessTokenAsync(sessionKey, context.RequestAborted).ConfigureAwait(false);
        SetServerAccessToken(context, accessToken);
        context.Response.OnStarting(static state =>
        {
            var response = (HttpResponse)state;
            response.Headers.CacheControl = "no-store";
            return Task.CompletedTask;
        }, context.Response);
        await _next(context).ConfigureAwait(false);
    }

    internal static void SetServerAccessToken(HttpContext context, string accessToken)
    {
        context.Items[AccessTokenItemKey] = accessToken;
    }

    internal static string GetServerAccessToken(HttpContext context)
    {
        if (context.Items.TryGetValue(AccessTokenItemKey, out var value) && value is string accessToken && !string.IsNullOrEmpty(accessToken))
            return accessToken;
        throw new AuthenticationRequiredException();
    }
}
