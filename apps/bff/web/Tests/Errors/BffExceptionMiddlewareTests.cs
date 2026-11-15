using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net.Sockets;
using Tdn.Bff.Errors;

namespace bff_web.Tests.Errors;

public sealed class BffExceptionMiddlewareTests
{
    [Theory]
    [MemberData(nameof(ErrorCases))]
    public async Task MapsFailuresToGenericNoStoreResponses(Exception exception, int expectedStatus, string expectedCode, string secret)
    {
        var context = CreateContext();
        var middleware = new BffExceptionMiddleware(_ => Task.FromException(exception), NullLogger<BffExceptionMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(expectedStatus, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        using var document = await ReadJsonAsync(context);
        Assert.Equal(expectedCode, document.RootElement.GetProperty("code").GetString());
        Assert.DoesNotContain(secret, document.RootElement.GetRawText());
    }

    [Fact]
    public async Task AbortedRequestCancellationDoesNotWriteErrorPayload()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var context = CreateContext();
        context.RequestAborted = cancellation.Token;
        var middleware = new BffExceptionMiddleware(_ => Task.FromException(new OperationCanceledException("synthetic-cancellation")), NullLogger<BffExceptionMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(0, context.Response.Body.Length);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Fact]
    public async Task UnexpectedFailureLogsDiagnosticDetailsWithoutExceptionMessagesOrRequestData()
    {
        const string exceptionSecret = "exception-secret-value";
        const string innerSecret = "inner-secret-value";
        const string requestSecret = "request-secret-value";
        var socketException = new SocketException((int)SocketError.ConnectionRefused);
        var context = CreateContext();
        context.TraceIdentifier = "trace-id-123";
        context.Request.QueryString = new QueryString("?code=" + requestSecret + "&state=" + requestSecret);
        context.Request.Headers.Cookie = requestSecret;
        context.Request.Headers.Authorization = requestSecret;
        context.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(requestSecret));
        context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask, RoutePatternFactory.Parse("bff/login"), 0, new EndpointMetadataCollection(), "login"));
        var logger = new CapturingLogger();
        var middleware = new BffExceptionMiddleware(_ => Task.FromException(CreateUnexpectedException(exceptionSecret, innerSecret, socketException)), logger);

        await middleware.InvokeAsync(context);

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Null(entry.Exception);
        Assert.Contains("trace-id-123", entry.Message);
        Assert.Contains("bff/login", entry.Message);
        Assert.Contains(typeof(InvalidOperationException).FullName!, entry.Message);
        Assert.Contains("ThrowUnexpectedException", entry.Message);
        Assert.Contains(typeof(ArgumentException).FullName!, entry.Message);
        Assert.Contains(typeof(SocketException).FullName!, entry.Message);
        Assert.Equal((object)socketException.SocketErrorCode, entry.Properties["SocketErrorCode"]);
        Assert.Equal((object)socketException.NativeErrorCode, entry.Properties["NativeErrorCode"]);
        Assert.DoesNotContain(exceptionSecret, entry.Message);
        Assert.DoesNotContain(innerSecret, entry.Message);
        Assert.DoesNotContain(requestSecret, entry.Message);
        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        using var document = await ReadJsonAsync(context);
        Assert.Equal("internal_error", document.RootElement.GetProperty("code").GetString());
        Assert.DoesNotContain(exceptionSecret, document.RootElement.GetRawText());
        Assert.DoesNotContain(innerSecret, document.RootElement.GetRawText());
    }

    public static IEnumerable<object[]> ErrorCases()
    {
        yield return [new AuthenticationRequiredException(), StatusCodes.Status401Unauthorized, "authentication_required", "auth-secret"];
        yield return [new AntiforgeryValidationException("csrf-secret"), StatusCodes.Status400BadRequest, "csrf_invalid", "csrf-secret"];
        yield return [new DependencyUnavailableException(new Exception("dependency-secret")), StatusCodes.Status503ServiceUnavailable, "dependency_unavailable", "dependency-secret"];
        yield return [new HttpRequestException("network-secret"), StatusCodes.Status503ServiceUnavailable, "dependency_unavailable", "network-secret"];
        yield return [new InvalidOperationException("unexpected-secret"), StatusCodes.Status500InternalServerError, "internal_error", "unexpected-secret"];
    }

    private static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static Exception CreateUnexpectedException(string exceptionSecret, string innerSecret, SocketException socketException)
    {
        try
        {
            ThrowUnexpectedException(exceptionSecret, innerSecret, socketException);
            throw new InvalidOperationException("unreachable");
        }
        catch (InvalidOperationException exception) when (exception.Message == exceptionSecret)
        {
            return exception;
        }
    }

    private static void ThrowUnexpectedException(string exceptionSecret, string innerSecret, SocketException socketException)
    {
        throw new InvalidOperationException(exceptionSecret, new ArgumentException(innerSecret, socketException));
    }

    private sealed class CapturingLogger : ILogger<BffExceptionMiddleware>
    {
        public List<LogEntry> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var properties = state is IEnumerable<KeyValuePair<string, object?>> values
                ? values.ToDictionary(value => value.Key, value => value.Value)
                : new Dictionary<string, object?>();
            Entries.Add(new LogEntry(logLevel, formatter(state, exception), exception, properties));
        }
    }

    private sealed record LogEntry(LogLevel Level, string Message, Exception? Exception, IReadOnlyDictionary<string, object?> Properties);

    private static async Task<JsonDocument> ReadJsonAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return await JsonDocument.ParseAsync(context.Response.Body);
    }
}
