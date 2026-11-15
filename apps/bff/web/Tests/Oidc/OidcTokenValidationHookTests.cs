using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Globalization;
using System.Net.Http;
using System.Net.Sockets;
using System.IO;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Tdn.Bff.Configuration;
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Oidc;

public sealed class OidcTokenValidationHookTests
{
    [Fact]
    public async Task PostConfigureUsesStandardTokenResponseValidatorAndAcceptsMatchingNonce()
    {
        var options = ConfigureOptions();
        var nonce = options.ProtocolValidator.GenerateNonce();
        var context = CreateTokenValidatedContext(options, nonce, nonce);

        Assert.NotNull(options.Events.OnTokenValidated);
        await options.Events.OnTokenValidated!(context);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PostConfigureRejectsMissingOrWrongNonce(bool missing)
    {
        var options = ConfigureOptions();
        var nonce = options.ProtocolValidator.GenerateNonce();
        var context = CreateTokenValidatedContext(options, nonce, missing ? null : options.ProtocolValidator.GenerateNonce());

        await Assert.ThrowsAnyAsync<OpenIdConnectProtocolException>(() => options.Events.OnTokenValidated!(context));
    }

    [Fact]
    public async Task AuthorizationCodeHookReadsFrameworkCodeVerifierParameter()
    {
        var tokenClient = new CapturingTokenClient();
        var options = ConfigureOptions(tokenClient);
        var request = new OpenIdConnectMessage { Code = "synthetic-code", RedirectUri = "https://bff.example/callback" };
        request.SetParameter("code_verifier", "synthetic-code-verifier");
        var context = new AuthorizationCodeReceivedContext(
            new DefaultHttpContext(),
            new AuthenticationScheme(BffAuthenticationDefaults.Oidc, BffAuthenticationDefaults.Oidc, typeof(OpenIdConnectHandler)),
            options,
            new AuthenticationProperties())
        {
            TokenEndpointRequest = request
        };

        await options.Events.OnAuthorizationCodeReceived!(context);

        Assert.Equal("synthetic-code", tokenClient.Code);
        Assert.Equal("https://bff.example/callback", tokenClient.RedirectUri);
        Assert.Equal("synthetic-code-verifier", tokenClient.CodeVerifier);
        Assert.Equal("synthetic-access-token", context.TokenEndpointResponse?.AccessToken);
    }

    [Fact]
    public async Task TicketReceivedWithMissingPropertiesFailsAuthentication()
    {
        var options = ConfigureOptions();
        var context = new TicketReceivedContext(
            new DefaultHttpContext(),
            new AuthenticationScheme(BffAuthenticationDefaults.Oidc, BffAuthenticationDefaults.Oidc, typeof(OpenIdConnectHandler)),
            options,
            null!);

        await options.Events.OnTicketReceived!(context);

        Assert.IsType<AuthenticationRequiredException>(context.Result?.Failure);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RemoteTransportFailureReturnsGatewayTimeoutWithoutCaching(bool typed)
    {
        var options = ConfigureOptions();
        Exception failure = typed
            ? new IdentityProviderUnavailableException(new Exception("secret"))
            : new InvalidOperationException("framework wrapper", new IOException("io", new HttpRequestException("network", new SocketException((int)SocketError.ConnectionRefused))));
        var context = CreateRemoteFailureContext(options, failure);

        await options.Events.OnRemoteFailure!(context);

        Assert.Equal(StatusCodes.Status504GatewayTimeout, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        context.Response.Body.Position = 0;
        using var document = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal("identity_provider_unavailable", document.RootElement.GetProperty("code").GetString());
    }

    [Theory]
    [InlineData(true, StatusCodes.Status401Unauthorized, "authentication_required")]
    [InlineData(false, StatusCodes.Status503ServiceUnavailable, "dependency_unavailable")]
    public async Task RemoteAuthAndDependencyFailuresKeepExistingMappings(bool authenticationFailure, int statusCode, string code)
    {
        var options = ConfigureOptions();
        Exception failure = authenticationFailure ? new AuthenticationRequiredException() : new DependencyUnavailableException();
        var context = CreateRemoteFailureContext(options, failure);

        await options.Events.OnRemoteFailure!(context);

        Assert.Equal(statusCode, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        context.Response.Body.Position = 0;
        using var document = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal(code, document.RootElement.GetProperty("code").GetString());
    }

    private static OpenIdConnectOptions ConfigureOptions(IOidcTokenClient? tokenClient = null)
    {
        var options = new OpenIdConnectOptions { ClientId = "synthetic-client" };
        var postConfigure = new BffOpenIdConnectPostConfigure(
            tokenClient ?? new FakeOidcTokenClient(),
            Options.Create(new BffOptions()),
            new FixedTimeProvider(DateTimeOffset.UtcNow));
        postConfigure.PostConfigure(BffAuthenticationDefaults.Oidc, options);
        return options;
    }

    private static TokenValidatedContext CreateTokenValidatedContext(OpenIdConnectOptions options, string tokenNonce, string? expectedNonce)
    {
        var issuedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var token = new JwtSecurityToken(
            "https://idp.example",
            "synthetic-client",
            [
                new Claim(JwtRegisteredClaimNames.Sub, "synthetic-subject"),
                new Claim(JwtRegisteredClaimNames.Nonce, tokenNonce),
                new Claim(JwtRegisteredClaimNames.Iat, issuedAt, ClaimValueTypes.Integer64)
            ],
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(5));
        var response = new OpenIdConnectMessage
        {
            AccessToken = "synthetic-access-token",
            IdToken = "synthetic-id-token",
            TokenType = "Bearer"
        };
        var context = new TokenValidatedContext(
            new DefaultHttpContext(),
            new AuthenticationScheme(BffAuthenticationDefaults.Oidc, BffAuthenticationDefaults.Oidc, typeof(OpenIdConnectHandler)),
            options,
            new ClaimsPrincipal(new ClaimsIdentity("test")),
            new AuthenticationProperties())
        {
            SecurityToken = token,
            TokenEndpointResponse = response,
            Nonce = expectedNonce
        };
        return context;
    }

    private static RemoteFailureContext CreateRemoteFailureContext(OpenIdConnectOptions options, Exception failure)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Response.Body = new MemoryStream();
        return new RemoteFailureContext(
            httpContext,
            new AuthenticationScheme(BffAuthenticationDefaults.Oidc, BffAuthenticationDefaults.Oidc, typeof(OpenIdConnectHandler)),
            options,
            failure);
    }

    private sealed class CapturingTokenClient : IOidcTokenClient
    {
        public string? Code { get; private set; }
        public string? RedirectUri { get; private set; }
        public string? CodeVerifier { get; private set; }

        public Task<OidcTokenResponse> RedeemCodeAsync(OpenIdConnectOptions options, string code, string redirectUri, string codeVerifier, CancellationToken cancellationToken)
        {
            Code = code;
            RedirectUri = redirectUri;
            CodeVerifier = codeVerifier;
            return Task.FromResult(new OidcTokenResponse(true, false, null, "synthetic-access-token", null, 300, "{\"access_token\":\"synthetic-access-token\"}"));
        }

        public Task<OidcTokenResponse> RefreshAsync(OpenIdConnectOptions options, string refreshToken, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
