using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Tdn.Bff.Errors;

namespace bff_web.Tests.Errors;

public sealed class BffExceptionMiddlewareTests
{
    [Theory]
    [MemberData(nameof(ErrorCases))]
    public async Task MapsFailuresToGenericNoStoreResponses(Exception exception, int expectedStatus, string expectedCode, string secret)
    {
        var context = CreateContext();
        var middleware = new BffExceptionMiddleware(_ => Task.FromException(exception));

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
        var middleware = new BffExceptionMiddleware(_ => Task.FromException(new OperationCanceledException("synthetic-cancellation")));

        await middleware.InvokeAsync(context);

        Assert.Equal(0, context.Response.Body.Length);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
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

    private static async Task<JsonDocument> ReadJsonAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return await JsonDocument.ParseAsync(context.Response.Body);
    }
}
