using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using System.Net.Sockets;
using StackExchange.Redis;

namespace Tdn.Bff.Errors;

public sealed class BffExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<BffExceptionMiddleware> _logger;

    public BffExceptionMiddleware(RequestDelegate next, ILogger<BffExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
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
                IdentityProviderUnavailableException => (StatusCodes.Status504GatewayTimeout, "identity_provider_unavailable"),
                AntiforgeryValidationException => (StatusCodes.Status400BadRequest, "csrf_invalid"),
                DependencyUnavailableException or RedisException or TimeoutException or HttpRequestException => (StatusCodes.Status503ServiceUnavailable, "dependency_unavailable"),
                _ => (StatusCodes.Status500InternalServerError, "internal_error")
            };

            if (statusCode == StatusCodes.Status500InternalServerError)
            {
                var innerExceptions = new List<string>();
                for (var inner = exception.InnerException; inner is not null; inner = inner.InnerException)
                {
                    innerExceptions.Add($"{inner.GetType().FullName}: {inner.StackTrace}");
                }

                var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText;
                var socketException = exception.GetBaseException() as SocketException;
                _logger.LogError(
                    "Unhandled BFF exception. RequestId={RequestId} Route={Route} ExceptionType={ExceptionType} StackTrace={StackTrace} InnerExceptions={InnerExceptions} SocketErrorCode={SocketErrorCode} NativeErrorCode={NativeErrorCode}",
                    context.TraceIdentifier,
                    route,
                    exception.GetType().FullName,
                    exception.StackTrace,
                    string.Join(Environment.NewLine, innerExceptions),
                    socketException?.SocketErrorCode,
                    socketException?.NativeErrorCode);
            }

            context.Response.Clear();
            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/json";
            context.Response.Headers.CacheControl = "no-store";
            await context.Response.WriteAsJsonAsync(new { code }, context.RequestAborted).ConfigureAwait(false);
        }
    }
}
