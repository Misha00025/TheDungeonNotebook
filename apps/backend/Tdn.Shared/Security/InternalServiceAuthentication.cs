using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Tdn.Shared.Security;

public sealed class InternalServiceAuthenticationMiddleware
{
    private const string HeaderName = "X-Internal-Service-Key";
    private static readonly HashSet<string> PublicPaths = ["/metrics", "/health/live", "/health/ready"];
    private readonly RequestDelegate _next;
    private readonly byte[] _key;

    public InternalServiceAuthenticationMiddleware(RequestDelegate next, byte[] key)
    {
        _next = next;
        _key = key;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (PublicPaths.Contains(context.Request.Path.Value ?? string.Empty))
        {
            await _next(context);
            return;
        }

        var values = context.Request.Headers[HeaderName];
        if (values.Count == 1 && values[0] is { } supplied && FixedEquals(supplied, _key))
        {
            await _next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";
        await JsonSerializer.SerializeAsync(context.Response.Body, new { error = "unauthorized" });
    }

    internal static bool FixedEquals(string value, byte[] key)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        return bytes.Length == key.Length && CryptographicOperations.FixedTimeEquals(bytes, key);
    }
}

public static class InternalServiceAuthenticationExtensions
{
    public static IApplicationBuilder UseInternalServiceAuthentication(this IApplicationBuilder app, IConfiguration configuration)
    {
        var directKey = configuration["INTERNAL_SERVICE_KEY"];
        var filePath = configuration["INTERNAL_SERVICE_KEY_FILE"];
        if (!string.IsNullOrEmpty(directKey) && !string.IsNullOrEmpty(filePath))
            throw new InvalidOperationException("Configure only one internal service key source.");

        string key;
        if (!string.IsNullOrEmpty(filePath))
        {
            key = File.ReadAllText(filePath).TrimEnd('\r', '\n');
        }
        else
        {
            key = directKey ?? throw new InvalidOperationException("Internal service key is not configured.");
        }

        var bytes = Encoding.UTF8.GetBytes(key);
        if (bytes.Length < 32)
            throw new InvalidOperationException("Internal service key must be at least 32 UTF-8 bytes.");

        return app.UseMiddleware<InternalServiceAuthenticationMiddleware>(bytes);
    }
}
