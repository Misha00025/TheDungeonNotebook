using System.Text.RegularExpressions;
using Tdn.Models.Access;

namespace Tdn.Middleware;

/// <summary>
/// Авторизация для game-systems-service. Одна роль — админ.
/// Требует наличия X-Subject. Для путей, содержащих systemId,
/// проверяет, что субъект является админом системы.
/// </summary>
public class SystemAccessMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SystemAccessMiddleware> _logger;

    public SystemAccessMiddleware(RequestDelegate next, ILogger<SystemAccessMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, SystemAccessHelper accessHelper)
    {
        var subject = context.Items["Subject"] as Subject;
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;

        _logger.LogInformation("[SYSTEM ACCESS] IN: {Method} {Path}, Subject={Subject}", method, path, subject);

        if (subject == null)
        {
            _logger.LogWarning("[SYSTEM ACCESS] DECISION: 403 - no Subject present");
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        var systemId = ExtractSystemId(path);
        if (systemId == null)
        {
            // Коллекционный уровень (GET /systems, POST /systems) — любой аутентифицированный субъект.
            _logger.LogInformation("[SYSTEM ACCESS] DECISION: allow - no systemId in URL, let controller decide");
            await _next(context);
            return;
        }

        if (!accessHelper.IsAdmin(systemId))
        {
            _logger.LogWarning("[SYSTEM ACCESS] DECISION: 403 - not an admin of system {SystemId}", systemId);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        _logger.LogInformation("[SYSTEM ACCESS] DECISION: allow -> next");
        await _next(context);
    }

    private static string? ExtractSystemId(string path)
    {
        var match = Regex.Match(path, @"/systems/([^/]+)");
        if (match.Success) return match.Groups[1].Value;
        return null;
    }
}
