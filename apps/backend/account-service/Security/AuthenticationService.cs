using System.IdentityModel.Tokens.Jwt;
using Tdn.Accounts.Configuration;

namespace Tdn.Accounts.Security;

public sealed record AuthenticationResult(TokenValidationStatus Status, VerifiedIdentity? Identity = null, GroupPrincipal? Group = null);

public sealed class AuthenticationService(LegacyGroupsOptions legacyOptions, LegacyGroupTokenValidator legacyValidator, OidcTokenValidator oidcValidator)
{
    public async Task<AuthenticationResult> ValidateAsync(string token, CancellationToken cancellationToken)
    {
        if (token.Length > 16384) return new(TokenValidationStatus.Invalid);
        string? issuer;
        try { issuer = new JwtSecurityTokenHandler().ReadJwtToken(token).Issuer; }
        catch { return new(TokenValidationStatus.Invalid); }
        if (legacyOptions.Enabled && StringComparer.Ordinal.Equals(issuer, legacyOptions.Issuer))
        {
            var principal = legacyValidator.Verify(token);
            return principal is null ? new(TokenValidationStatus.Invalid) : new(TokenValidationStatus.Valid, Group: principal);
        }
        var result = await oidcValidator.ValidateAsync(token, cancellationToken);
        return new AuthenticationResult(result.Status, result.Identity);
    }
}
