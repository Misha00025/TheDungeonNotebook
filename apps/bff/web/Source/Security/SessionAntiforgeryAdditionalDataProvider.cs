using Microsoft.AspNetCore.Antiforgery;
using Tdn.Bff.Sessions;

namespace Tdn.Bff.Security;

public sealed class SessionAntiforgeryAdditionalDataProvider : IAntiforgeryAdditionalDataProvider
{
    public string GetAdditionalData(HttpContext context) =>
        context.User.FindFirst(BffAuthenticationDefaults.SessionClaim)?.Value ?? string.Empty;

    public bool ValidateAdditionalData(HttpContext context, string additionalData)
    {
        var sessionClaim = context.User.FindFirst(BffAuthenticationDefaults.SessionClaim)?.Value;
        return !string.IsNullOrEmpty(sessionClaim) && string.Equals(sessionClaim, additionalData, StringComparison.Ordinal);
    }
}
