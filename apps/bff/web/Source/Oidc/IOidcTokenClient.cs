using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace Tdn.Bff.Oidc;

public interface IOidcTokenClient
{
    Task<OidcTokenResponse> RedeemCodeAsync(OpenIdConnectOptions options, string code, string redirectUri, string codeVerifier, CancellationToken cancellationToken);
    Task<OidcTokenResponse> RefreshAsync(OpenIdConnectOptions options, string refreshToken, CancellationToken cancellationToken);
}

public sealed record OidcTokenResponse(bool IsSuccess, bool IsInvalidGrant, string? Error, string? AccessToken, string? RefreshToken, long? ExpiresIn, string? RawJson);
