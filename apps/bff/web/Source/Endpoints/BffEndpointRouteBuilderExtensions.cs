using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using Tdn.Bff.Configuration;
using Tdn.Bff.Errors;
using Tdn.Bff.Security;
using Tdn.Bff.Sessions;
using Tdn.Bff.Oidc;
using Tdn.Bff.PlayerScreens;

namespace Tdn.Bff.Endpoints;

public static class BffEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapBffEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var options = endpoints.ServiceProvider.GetRequiredService<IOptions<BffOptions>>().Value;
        endpoints.MapGet(options.Endpoints.Login, async (HttpContext context, IUrlHelperFactory urlHelperFactory) =>
        {
            var returnUrl = context.Request.Query.TryGetValue("returnUrl", out var requestedReturnUrl)
                ? requestedReturnUrl.ToString()
                : "/";
            await HandleLoginAsync(context, returnUrl, urlHelperFactory, options.Web.PublicOrigin).ConfigureAwait(false);
        });

        endpoints.MapGet(options.Endpoints.Session, async (HttpContext context, IAntiforgery antiforgery, IOptions<AntiforgeryOptions> antiforgeryOptions, ISessionTokenService sessionTokenService) =>
            await HandleSessionAsync(context, antiforgery, antiforgeryOptions.Value.HeaderName ?? "X-CSRF-TOKEN", sessionTokenService).ConfigureAwait(false));

        endpoints.MapGet("/bff/api/player/campaigns/{campaignId:int}/characters", (HttpContext context, int campaignId, PlayerScreenService screens) =>
            screens.ListCharactersAsync(context, campaignId)).RequireAuthorization();
        endpoints.MapGet("/bff/api/player/campaigns/{campaignId:int}/characters/{characterId}", (HttpContext context, int campaignId, string characterId, PlayerScreenService screens) =>
            screens.GetCharacterScreenAsync(context, campaignId, characterId)).RequireAuthorization();

        endpoints.MapPost(options.Endpoints.Logout, async (HttpContext context, IAntiforgeryRequestValidator antiforgeryValidator, IOptionsMonitor<OpenIdConnectOptions> oidcOptions) =>
            await HandleLogoutAsync(context, antiforgeryValidator, oidcOptions.Get(BffAuthenticationDefaults.Oidc).SignedOutRedirectUri, options.Web.PublicOrigin).ConfigureAwait(false))
            .RequireAuthorization();

        endpoints.MapGet(options.Endpoints.LogoutContinuation, HandleLogoutContinuationAsync).AllowAnonymous();

        return endpoints;
    }

    public static async Task HandleLoginAsync(HttpContext context, string? returnUrl, IUrlHelperFactory urlHelperFactory, string? publicOrigin = null)
    {
        SetNoStore(context.Response);
        returnUrl ??= "/";
        var actionContext = new ActionContext(context, new RouteData(), new ActionDescriptor());
        var urlHelper = urlHelperFactory.GetUrlHelper(actionContext);
        if (!urlHelper.IsLocalUrl(returnUrl))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { code = "invalid_return_url" }, context.RequestAborted).ConfigureAwait(false);
            return;
        }

        var redirectUri = returnUrl.StartsWith("~/", StringComparison.Ordinal) ? urlHelper.Content(returnUrl) : returnUrl;
        if (!string.IsNullOrWhiteSpace(publicOrigin))
            redirectUri = $"{publicOrigin.TrimEnd('/')}{redirectUri}";
        await context.ChallengeAsync(BffAuthenticationDefaults.Oidc, new AuthenticationProperties { RedirectUri = redirectUri }).ConfigureAwait(false);
    }

    public static async Task HandleSessionAsync(HttpContext context, IAntiforgery antiforgery, string csrfHeaderName, ISessionTokenService sessionTokenService)
    {
        SetNoStore(context.Response);
        var authentication = await context.AuthenticateAsync(BffAuthenticationDefaults.Cookies).ConfigureAwait(false);
        if (!authentication.Succeeded || authentication.Principal is null)
        {
            await context.Response.WriteAsJsonAsync(new
            {
                authenticated = false,
                csrfToken = (string?)null,
                csrfHeaderName
            }, context.RequestAborted).ConfigureAwait(false);
            return;
        }

        context.User = authentication.Principal;
        if (context.User.FindFirst(BffAuthenticationDefaults.SessionClaim) is null)
            throw new AuthenticationRequiredException();

        var sessionKey = context.User.FindFirst(BffAuthenticationDefaults.SessionClaim)!.Value;
        try
        {
            await sessionTokenService.GetAccessTokenAsync(sessionKey, context.RequestAborted).ConfigureAwait(false);
        }
        catch (AuthenticationRequiredException)
        {
            await context.SignOutAsync(BffAuthenticationDefaults.Cookies).ConfigureAwait(false);
            await context.Response.WriteAsJsonAsync(new
            {
                authenticated = false,
                csrfToken = (string?)null,
                csrfHeaderName
            }, context.RequestAborted).ConfigureAwait(false);
            return;
        }

        var tokens = antiforgery.GetAndStoreTokens(context);
        await context.Response.WriteAsJsonAsync(new
        {
            authenticated = true,
            csrfToken = tokens.RequestToken,
            csrfHeaderName
        }, context.RequestAborted).ConfigureAwait(false);
    }

    public static async Task HandleLogoutAsync(HttpContext context, IAntiforgeryRequestValidator antiforgeryValidator, string? signedOutRedirectUri = "/login", string? publicOrigin = null)
    {
        SetNoStore(context.Response);
        await antiforgeryValidator.ValidateUnsafeRequestAsync(context).ConfigureAwait(false);
        await context.SignOutAsync(BffAuthenticationDefaults.Cookies).ConfigureAwait(false);
        var redirectUri = signedOutRedirectUri;
        if (string.IsNullOrWhiteSpace(redirectUri))
            redirectUri = "/login";
        if (Uri.TryCreate(redirectUri, UriKind.Relative, out _) && redirectUri.StartsWith('/') && !redirectUri.StartsWith("//", StringComparison.Ordinal) && !string.IsNullOrWhiteSpace(publicOrigin))
            redirectUri = $"{publicOrigin.TrimEnd('/')}{redirectUri}";
        await context.SignOutAsync(BffAuthenticationDefaults.Oidc, new AuthenticationProperties { RedirectUri = redirectUri }).ConfigureAwait(false);
    }

    public static async Task HandleLogoutContinuationAsync(HttpContext context, ILogoutRedirectStore store)
    {
        SetNoStore(context.Response);
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        var request = context.Request.Query["request"].ToString();
        var redirectUrl = string.IsNullOrWhiteSpace(request) ? null : await store.TakeAsync(request, context.RequestAborted).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(redirectUrl))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { code = "invalid_logout_request" }, context.RequestAborted).ConfigureAwait(false);
            return;
        }
        context.Response.Redirect(redirectUrl);
    }

    private static void SetNoStore(HttpResponse response)
    {
        response.Headers.CacheControl = "no-store";
    }
}
