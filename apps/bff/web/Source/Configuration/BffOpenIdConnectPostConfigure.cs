using System.Net.Http;
using System.Globalization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.Extensions.Options;
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;

namespace Tdn.Bff.Configuration;

public sealed class BffOpenIdConnectPostConfigure : IPostConfigureOptions<OpenIdConnectOptions>
{
    private readonly IOidcTokenClient _tokenClient;
    private readonly IOptions<BffOptions> _bffOptions;
    private readonly TimeProvider _timeProvider;

    public BffOpenIdConnectPostConfigure(IOidcTokenClient tokenClient, IOptions<BffOptions> bffOptions, TimeProvider timeProvider)
    {
        _tokenClient = tokenClient;
        _bffOptions = bffOptions;
        _timeProvider = timeProvider;
    }

    public void PostConfigure(string? name, OpenIdConnectOptions options)
    {
        if (!string.Equals(name, Sessions.BffAuthenticationDefaults.Oidc, StringComparison.Ordinal))
            return;

        options.SignInScheme = Sessions.BffAuthenticationDefaults.Cookies;
        options.ResponseType = OpenIdConnectResponseType.Code;
        options.UsePkce = true;
        options.SaveTokens = true;
        options.MapInboundClaims = false;
        options.GetClaimsFromUserInfoEndpoint = false;
        options.UseTokenLifetime = false;
        options.PushedAuthorizationBehavior = PushedAuthorizationBehavior.Disable;
        options.CallbackPath = string.IsNullOrEmpty(options.CallbackPath) ? "/bff/callback" : options.CallbackPath;
        options.RemoteSignOutPath = PathString.Empty;
        options.SignedOutCallbackPath = PathString.Empty;
        options.Events ??= new OpenIdConnectEvents();
        options.Events.OnAuthorizationCodeReceived = RedeemAuthorizationCodeAsync;
        options.Events.OnTokenValidated = ValidateTokenResponse;
        options.Events.OnTicketReceived = EnsureAccessTokenAsync;
        options.Events.OnRemoteFailure = HandleRemoteFailureAsync;
    }

    private async Task RedeemAuthorizationCodeAsync(AuthorizationCodeReceivedContext context)
    {
        var request = context.TokenEndpointRequest;
        var code = request?.Code;
        var redirectUri = request?.RedirectUri;
        var codeVerifier = request?.GetParameter("code_verifier");
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(redirectUri) || string.IsNullOrWhiteSpace(codeVerifier))
            throw new AuthenticationRequiredException();

        var response = await _tokenClient.RedeemCodeAsync(context.Options, code, redirectUri, codeVerifier, context.HttpContext.RequestAborted).ConfigureAwait(false);
        if (!response.IsSuccess)
            throw new AuthenticationRequiredException();
        if (string.IsNullOrWhiteSpace(response.AccessToken) || response.RawJson is null)
            throw new AuthenticationRequiredException();

        context.HandleCodeRedemption(new OpenIdConnectMessage(response.RawJson));
    }

    private static Task ValidateTokenResponse(TokenValidatedContext context)
    {
        if (context.TokenEndpointResponse is { } tokenEndpointResponse)
        {
            context.Options.ProtocolValidator.ValidateTokenResponse(new OpenIdConnectProtocolValidationContext
            {
                ClientId = context.Options.ClientId!,
                ProtocolMessage = tokenEndpointResponse,
                ValidatedIdToken = context.SecurityToken,
                Nonce = context.Nonce!
            });
        }
        return Task.CompletedTask;
    }

    private Task EnsureAccessTokenAsync(TicketReceivedContext context)
    {
        var properties = context.Properties;
        if (properties is null)
        {
            context.Fail(new AuthenticationRequiredException());
            return Task.CompletedTask;
        }
        var accessToken = properties.GetTokenValue("access_token");
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            context.Fail(new AuthenticationRequiredException());
            return Task.CompletedTask;
        }

        if (!DateTimeOffset.TryParse(properties.GetTokenValue("expires_at"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _))
        {
            var expiresAt = _timeProvider.GetUtcNow() + _bffOptions.Value.Session.AccessTokenLifetimeWhenMissing;
            var tokens = properties.GetTokens().Where(token => token.Name != "expires_at").ToList();
            tokens.Add(new AuthenticationToken { Name = "expires_at", Value = expiresAt.ToString("O") });
            properties.StoreTokens(tokens);
        }
        return Task.CompletedTask;
    }

    private static async Task HandleRemoteFailureAsync(RemoteFailureContext context)
    {
        context.HandleResponse();
        if (context.HttpContext.RequestAborted.IsCancellationRequested)
            return;
        var dependencyFailure = IsDependencyFailure(context.Failure);
        var code = dependencyFailure ? "dependency_unavailable" : "authentication_required";
        context.Response.StatusCode = dependencyFailure ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";
        context.Response.Headers.CacheControl = "no-store";
        await context.Response.WriteAsJsonAsync(new { code }, context.HttpContext.RequestAborted).ConfigureAwait(false);
    }

    private static bool IsDependencyFailure(Exception? exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is DependencyUnavailableException or HttpRequestException or TimeoutException or OperationCanceledException or StackExchange.Redis.RedisException)
                return true;
        }
        return false;
    }
}
