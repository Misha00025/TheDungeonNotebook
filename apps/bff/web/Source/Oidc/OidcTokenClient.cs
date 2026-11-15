using System.Net;
using System.Net.Http;
using System.Text.Json;
using Duende.IdentityModel.Client;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.Extensions.Options;
using Tdn.Bff.Configuration;
using Tdn.Bff.Errors;

namespace Tdn.Bff.Oidc;

public sealed class OidcTokenClient : IOidcTokenClient
{
    private readonly IOptions<BffOptions> _bffOptions;

    public OidcTokenClient(IOptions<BffOptions> bffOptions)
    {
        _bffOptions = bffOptions;
    }

    public async Task<OidcTokenResponse> RedeemCodeAsync(OpenIdConnectOptions options, string code, string redirectUri, string codeVerifier, CancellationToken cancellationToken)
    {
        try
        {
            var configuration = await GetConfigurationAsync(options, cancellationToken).ConfigureAwait(false);
            var request = new AuthorizationCodeTokenRequest
            {
                Address = configuration.TokenEndpoint,
                ClientId = options.ClientId!,
                ClientSecret = _bffOptions.Value.ClientAuthentication == ClientAuthentication.None ? null : options.ClientSecret,
                ClientCredentialStyle = GetCredentialStyle(),
                Code = code,
                RedirectUri = redirectUri,
                CodeVerifier = codeVerifier
            };
            return await SendAsync(options, request, cancellationToken, (client, tokenRequest, ct) => client.RequestAuthorizationCodeTokenAsync((AuthorizationCodeTokenRequest)tokenRequest, ct)).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new IdentityProviderUnavailableException();
        }
        catch (HttpRequestException exception)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new IdentityProviderUnavailableException(exception);
        }
        catch (TimeoutException exception)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new IdentityProviderUnavailableException(exception);
        }
    }

    public async Task<OidcTokenResponse> RefreshAsync(OpenIdConnectOptions options, string refreshToken, CancellationToken cancellationToken)
    {
        try
        {
            var configuration = await GetConfigurationAsync(options, cancellationToken).ConfigureAwait(false);
            var request = new RefreshTokenRequest
            {
                Address = configuration.TokenEndpoint,
                ClientId = options.ClientId!,
                ClientSecret = _bffOptions.Value.ClientAuthentication == ClientAuthentication.None ? null : options.ClientSecret,
                ClientCredentialStyle = GetCredentialStyle(),
                RefreshToken = refreshToken
            };
            return await SendAsync(options, request, cancellationToken, (client, tokenRequest, ct) => client.RequestRefreshTokenAsync((RefreshTokenRequest)tokenRequest, ct)).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new IdentityProviderUnavailableException();
        }
        catch (HttpRequestException exception)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new IdentityProviderUnavailableException(exception);
        }
        catch (TimeoutException exception)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new IdentityProviderUnavailableException(exception);
        }
    }

    private static async Task<OpenIdConnectConfiguration> GetConfigurationAsync(OpenIdConnectOptions options, CancellationToken cancellationToken)
    {
        try
        {
            return await options.ConfigurationManager!.GetConfigurationAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (OidcTransportFailure.IsTransportFailure(exception))
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new IdentityProviderUnavailableException(exception);
        }
    }

    private ClientCredentialStyle GetCredentialStyle() => _bffOptions.Value.ClientAuthentication switch
    {
        ClientAuthentication.PostBody => ClientCredentialStyle.PostBody,
        ClientAuthentication.Basic => ClientCredentialStyle.AuthorizationHeader,
        ClientAuthentication.None => ClientCredentialStyle.PostBody,
        _ => throw new InvalidOperationException("Unsupported client authentication style.")
    };

    private static async Task<OidcTokenResponse> SendAsync(OpenIdConnectOptions options, TokenRequest request, CancellationToken cancellationToken, Func<HttpClient, TokenRequest, CancellationToken, Task<TokenResponse>> send)
    {
        try
        {
            var response = await send(options.Backchannel, request, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            if (response.Exception is not null || response.ErrorType == ResponseErrorType.Exception)
            {
                if (OidcTransportFailure.IsTransportFailure(response.Exception))
                    throw new IdentityProviderUnavailableException(response.Exception);
                throw new DependencyUnavailableException(response.Exception);
            }
            if (response.HttpStatusCode == HttpStatusCode.TooManyRequests || (int)response.HttpStatusCode >= 500 || response.Error == "invalid_client")
                throw new DependencyUnavailableException();
            if (response.IsError)
            {
                return new OidcTokenResponse(false, response.Error == "invalid_grant", response.Error, null, null, null, null);
            }

            var responseJson = response.Json;
            if (!responseJson.HasValue || responseJson.Value.ValueKind != JsonValueKind.Object)
                throw new DependencyUnavailableException();
            var json = responseJson.Value;
            var accessToken = ReadString(json, "access_token");
            var refreshToken = ReadString(json, "refresh_token");
            if (string.IsNullOrWhiteSpace(accessToken))
                throw new DependencyUnavailableException();
            if (json.TryGetProperty("refresh_token", out var refreshTokenElement) && refreshTokenElement.ValueKind is not JsonValueKind.String and not JsonValueKind.Null)
                throw new DependencyUnavailableException();
            var expiresIn = ReadInt64(json, "expires_in");
            return new OidcTokenResponse(true, false, null, accessToken, refreshToken, expiresIn, json.GetRawText());
        }
        catch (DependencyUnavailableException)
        {
            throw;
        }
        catch (IdentityProviderUnavailableException)
        {
            throw;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new IdentityProviderUnavailableException();
        }
        catch (HttpRequestException exception)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new IdentityProviderUnavailableException(exception);
        }
        catch (TimeoutException exception)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new IdentityProviderUnavailableException(exception);
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or FormatException)
        {
            throw new DependencyUnavailableException(exception);
        }
    }

    private static string? ReadString(JsonElement json, string propertyName) =>
        json.ValueKind == JsonValueKind.Object && json.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static long? ReadInt64(JsonElement json, string propertyName)
    {
        if (!json.TryGetProperty(propertyName, out var value))
            return null;
        if (value.ValueKind != JsonValueKind.Number || !value.TryGetInt64(out var result))
            throw new DependencyUnavailableException();
        return result;
    }
}
