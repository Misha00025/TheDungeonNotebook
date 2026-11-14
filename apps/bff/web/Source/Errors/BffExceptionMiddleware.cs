using Microsoft.AspNetCore.Antiforgery;
using StackExchange.Redis;

namespace Tdn.Bff.Errors;

public sealed class BffExceptionMiddleware
{
    private readonly RequestDelegate _next;

    public BffExceptionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            var (statusCode, code) = exception switch
            {
                AuthenticationRequiredException => (StatusCodes.Status401Unauthorized, "authentication_required"),
                AntiforgeryValidationException => (StatusCodes.Status400BadRequest, "csrf_invalid"),
                DependencyUnavailableException or RedisException or TimeoutException or HttpRequestException => (StatusCodes.Status503ServiceUnavailable, "dependency_unavailable"),
                _ => (StatusCodes.Status500InternalServerError, "internal_error")
            };

            context.Response.Clear();
            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/json";
            context.Response.Headers.CacheControl = "no-store";
            await context.Response.WriteAsJsonAsync(new { code }, context.RequestAborted).ConfigureAwait(false);
        }
    }
}
