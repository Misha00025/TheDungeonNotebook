using System.Net;
using System.Text;
using Duende.IdentityModel.Client;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.Extensions.Options;
using Tdn.Bff.Configuration;
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;

namespace bff_web.Tests.Oidc;

public sealed class OidcTokenClientTests
{
    [Fact]
    public async Task CodeRequestIncludesVerifierRedirectAndPostBodyCredentials()
    {
        string? capturedForm = null;
        var (client, options) = CreateClient(ClientAuthentication.PostBody, _ =>
        {
            capturedForm = _.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return JsonResponse(HttpStatusCode.OK, "{\"access_token\":\"synthetic-access\",\"refresh_token\":\"synthetic-refresh\",\"expires_in\":300}");
        });

        var result = await client.RedeemCodeAsync(options, "synthetic-code", "https://bff.example/bff/callback", "synthetic-verifier", CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Contains("code=synthetic-code", capturedForm);
        Assert.Contains("redirect_uri=https%3A%2F%2Fbff.example%2Fbff%2Fcallback", capturedForm);
        Assert.Contains("code_verifier=synthetic-verifier", capturedForm);
        Assert.Contains("client_id=synthetic-client", capturedForm);
        Assert.Contains("client_secret=synthetic-secret", capturedForm);
    }

    [Fact]
    public async Task BasicClientAuthenticationUsesAuthorizationHeaderForRefresh()
    {
        string? capturedForm = null;
        string? authorization = null;
        var (client, options) = CreateClient(ClientAuthentication.Basic, request =>
        {
            capturedForm = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            authorization = request.Headers.Authorization?.ToString();
            return JsonResponse(HttpStatusCode.OK, "{\"access_token\":\"synthetic-access\",\"expires_in\":300}");
        });

        var result = await client.RefreshAsync(options, "synthetic-refresh", CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("synthetic-client:synthetic-secret")), authorization);
        Assert.Contains("grant_type=refresh_token", capturedForm);
        Assert.Contains("refresh_token=synthetic-refresh", capturedForm);
        Assert.DoesNotContain("client_secret", capturedForm);
    }

    [Fact]
    public async Task NoneClientAuthenticationSendsClientIdButNoSecretForCodeAndRefresh()
    {
        var requests = new List<(string Form, string? Authorization)>();
        var (client, options) = CreateClient(ClientAuthentication.None, request =>
        {
            requests.Add((request.Content!.ReadAsStringAsync().GetAwaiter().GetResult(), request.Headers.Authorization?.ToString()));
            return JsonResponse(HttpStatusCode.OK, "{\"access_token\":\"synthetic-access\",\"expires_in\":300}");
        });

        await client.RedeemCodeAsync(options, "synthetic-code", "https://bff.example/callback", "synthetic-verifier", CancellationToken.None);
        await client.RefreshAsync(options, "synthetic-refresh", CancellationToken.None);

        foreach (var request in requests)
        {
            Assert.Contains("client_id=synthetic-client", request.Form);
            Assert.DoesNotContain("client_secret", request.Form);
            Assert.Null(request.Authorization);
        }
    }

    [Fact]
    public async Task InvalidGrantIsReturnedAsProtocolFailure()
    {
        var (client, options) = CreateClient(ClientAuthentication.PostBody, _ => JsonResponse(HttpStatusCode.BadRequest, "{\"error\":\"invalid_grant\"}"));

        var result = await client.RefreshAsync(options, "synthetic-refresh", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.True(result.IsInvalidGrant);
        Assert.Null(result.RawJson);
    }

    [Fact]
    public async Task OtherProtocolErrorsAreNotClassifiedAsInvalidGrant()
    {
        var (client, options) = CreateClient(ClientAuthentication.PostBody, _ => JsonResponse(HttpStatusCode.BadRequest, "{\"error\":\"invalid_scope\"}"));

        var result = await client.RefreshAsync(options, "synthetic-refresh", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.False(result.IsInvalidGrant);
    }

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    public async Task ServerAndRateLimitResponsesAreDependencyFailures(HttpStatusCode statusCode)
    {
        var (client, options) = CreateClient(ClientAuthentication.PostBody, _ => JsonResponse(statusCode, "{\"error\":\"temporarily_unavailable\"}"));

        await Assert.ThrowsAsync<DependencyUnavailableException>(() => client.RefreshAsync(options, "synthetic-refresh", CancellationToken.None));
    }

    [Fact]
    public async Task InvalidClientNetworkTimeoutAndMalformedJsonAreDependencyFailures()
    {
        var (invalidClient, invalidClientOptions) = CreateClient(ClientAuthentication.PostBody, _ => JsonResponse(HttpStatusCode.BadRequest, "{\"error\":\"invalid_client\"}"));
        await Assert.ThrowsAsync<DependencyUnavailableException>(() => invalidClient.RefreshAsync(invalidClientOptions, "synthetic-refresh", CancellationToken.None));

        var (network, networkOptions) = CreateClient(ClientAuthentication.PostBody, _ => throw new HttpRequestException("synthetic-network-error"));
        await Assert.ThrowsAsync<DependencyUnavailableException>(() => network.RefreshAsync(networkOptions, "synthetic-refresh", CancellationToken.None));

        var (timeout, timeoutOptions) = CreateClient(ClientAuthentication.PostBody, _ => throw new TaskCanceledException("synthetic-timeout"));
        await Assert.ThrowsAsync<DependencyUnavailableException>(() => timeout.RefreshAsync(timeoutOptions, "synthetic-refresh", CancellationToken.None));

        var (malformed, malformedOptions) = CreateClient(ClientAuthentication.PostBody, _ => JsonResponse(HttpStatusCode.OK, "{not-json"));
        await Assert.ThrowsAsync<DependencyUnavailableException>(() => malformed.RefreshAsync(malformedOptions, "synthetic-refresh", CancellationToken.None));
    }

    private static (OidcTokenClient Client, OpenIdConnectOptions Options) CreateClient(ClientAuthentication authentication, Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
    {
        var bffOptions = Options.Create(new BffOptions { ClientAuthentication = authentication });
        var configuration = new OpenIdConnectConfiguration { TokenEndpoint = "https://idp.example/token" };
        var oidcOptions = new OpenIdConnectOptions
        {
            ClientId = "synthetic-client",
            ClientSecret = "synthetic-secret",
            ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(configuration),
            Backchannel = new HttpClient(new DelegateHttpMessageHandler(responseFactory))
        };
        return (new OidcTokenClient(bffOptions), oidcOptions);
    }

    private static HttpResponseMessage JsonResponse(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private sealed class DelegateHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responseFactory;

        public DelegateHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        {
            _responseFactory = responseFactory;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(_responseFactory(request));
    }
}
