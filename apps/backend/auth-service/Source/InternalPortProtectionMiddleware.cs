using System.Text.Json;

namespace Tdn.Api.Middleware;

public class InternalPortProtectionMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly HashSet<string> _internalOnlyPrefixes = new()
    {
        "/auth/groups/",
        "/auth/reset-password/request/",
    };
    private const int InternalPort = 8081;

    public InternalPortProtectionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var port = context.Connection.LocalPort;
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

        if (port != InternalPort && _internalOnlyPrefixes.Any(prefix => path.StartsWith(prefix)))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            var body = JsonSerializer.Serialize(new { error = "Forbidden: internal endpoint" });
            await context.Response.WriteAsync(body);
            return;
        }

        await _next(context);
    }
}
