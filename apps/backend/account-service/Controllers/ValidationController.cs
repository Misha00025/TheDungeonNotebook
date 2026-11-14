using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Tdn.Accounts.Configuration;
using Tdn.Accounts.Contracts;
using Tdn.Accounts.Persistence;
using Tdn.Accounts.Security;

namespace Tdn.Accounts.Controllers;

[ApiController]
public sealed class ValidationController(AuthenticationService authentication, IAccountStore store, InternalServiceKey internalKey) : ControllerBase
{
    [HttpPost("/internal/auth/validate")]
    public async Task<IActionResult> Validate(CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var supplied = Encoding.UTF8.GetBytes(Request.Headers["X-Account-Service-Key"].ToString());
        var expected = Encoding.UTF8.GetBytes(internalKey.Value);
        if (supplied.Length != expected.Length || !CryptographicOperations.FixedTimeEquals(supplied, expected)) return Unauthorized();
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal) || header.Length <= 7 || header[7..].Contains(' ') || header[7..].Length > 16384) return Ok(new ValidateResponse(false));
        try
        {
            var validation = await authentication.ValidateAsync(header[7..], ct);
            if (validation.Status == TokenValidationStatus.Invalid) return Ok(new ValidateResponse(false));
            if (validation.Status == TokenValidationStatus.InsufficientScope) return StatusCode(403, new ValidateResponse(false, Error: "insufficient_scope"));
            if (validation.Status == TokenValidationStatus.Unavailable) return StatusCode(503, new ValidateResponse(false, Error: "dependency_unavailable"));
            if (validation.Group is not null) return Ok(new ValidateResponse(true, GroupId: validation.Group.GroupId, AccessLevel: validation.Group.AccessLevel));
            var id = await store.ResolveOrCreateAsync(validation.Identity!, ct);
            return Ok(new ValidateResponse(true, id));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch { return StatusCode(503, new ValidateResponse(false, Error: "dependency_unavailable")); }
    }
}
