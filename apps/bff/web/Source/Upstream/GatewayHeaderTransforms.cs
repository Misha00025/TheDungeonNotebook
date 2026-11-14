using System.Net.Http.Headers;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;
using Tdn.Bff.Configuration;
using Yarp.ReverseProxy.Transforms;
using Yarp.ReverseProxy.Transforms.Builder;

namespace Tdn.Bff.Upstream;

public static class GatewayHeaderTransforms
{
    private static readonly HashSet<string> RequestForbiddenHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Authorization",
        "Proxy-Authorization",
        "Cookie",
        "Set-Cookie",
        "X-Subject",
        "X-User-Id",
        "X-Account-Id",
        "X-Account-Service-Key",
        "X-Internal-Service-Key"
    };

    private static readonly HashSet<string> ResponseForbiddenHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cookie",
        "Set-Cookie",
        "Authorization",
        "Proxy-Authorization",
        "X-Subject",
        "X-User-Id",
        "X-Account-Id",
        "X-Account-Service-Key",
        "X-Internal-Service-Key"
    };

    public static void AddTransforms(TransformBuilderContext transformBuilderContext)
    {
        var services = transformBuilderContext.Services;
        var options = services.GetRequiredService<IOptions<BffOptions>>().Value;
        var antiforgeryOptions = services.GetRequiredService<IOptions<AntiforgeryOptions>>().Value;
        var requestAllowList = new HashSet<string>(options.Transport.RequestHeaders, StringComparer.OrdinalIgnoreCase);
        var responseAllowList = new HashSet<string>(options.Transport.ResponseHeaders, StringComparer.OrdinalIgnoreCase);
        var csrfHeaderName = antiforgeryOptions.HeaderName;

        transformBuilderContext.UseDefaultForwarders = false;
        transformBuilderContext.AddRequestTransform(context =>
        {
            FilterRequestHeaders(context.ProxyRequest, requestAllowList, csrfHeaderName);
            context.ProxyRequest.Headers.Host = null;
            var token = GatewaySessionMiddleware.GetServerAccessToken(context.HttpContext);
            context.ProxyRequest.Headers.TryAddWithoutValidation("Authorization", $"Bearer {token}");
            return ValueTask.CompletedTask;
        });

        transformBuilderContext.AddResponseTransform(context =>
        {
            FilterResponseHeaders(context.HttpContext.Response.Headers, responseAllowList, csrfHeaderName);
            return ValueTask.CompletedTask;
        });

        transformBuilderContext.AddResponseTrailersTransform(context =>
        {
            var trailers = context.HttpContext.Features.Get<IHttpResponseTrailersFeature>()?.Trailers;
            if (trailers is not null)
                FilterResponseHeaders(trailers, responseAllowList, csrfHeaderName);
            return ValueTask.CompletedTask;
        });
    }

    public static void FilterRequestHeaders(HttpRequestMessage request, IReadOnlySet<string> allowList, string? csrfHeaderName)
    {
        FilterHttpHeaders(request.Headers, allowList, csrfHeaderName);
        if (request.Content is not null)
            FilterHttpHeaders(request.Content.Headers, allowList, csrfHeaderName);
        request.Headers.Host = null;
        request.Headers.Remove("Host");
    }

    public static void FilterResponseHeaders(IHeaderDictionary headers, IReadOnlySet<string> allowList, string? csrfHeaderName)
    {
        foreach (var name in headers.Keys.ToArray())
        {
            if (!IsResponseHeaderAllowed(name, allowList, csrfHeaderName))
                headers.Remove(name);
        }
    }

    public static bool IsRequestHeaderAllowed(string name, IReadOnlySet<string> allowList, string? csrfHeaderName)
    {
        if (RequestForbiddenHeaders.Contains(name) || IsCsrfHeader(name, csrfHeaderName) || IsForwardedHeader(name))
            return false;
        return allowList.Contains(name);
    }

    public static bool IsResponseHeaderAllowed(string name, IReadOnlySet<string> allowList, string? csrfHeaderName)
    {
        if (ResponseForbiddenHeaders.Contains(name) || IsCsrfHeader(name, csrfHeaderName))
            return false;
        return allowList.Contains(name);
    }

    private static void FilterHttpHeaders(HttpHeaders headers, IReadOnlySet<string> allowList, string? csrfHeaderName)
    {
        foreach (var name in headers.Select(header => header.Key).ToArray())
        {
            if (!IsRequestHeaderAllowed(name, allowList, csrfHeaderName))
                headers.Remove(name);
        }
    }

    private static bool IsCsrfHeader(string name, string? csrfHeaderName) =>
        !string.IsNullOrWhiteSpace(csrfHeaderName) && string.Equals(name, csrfHeaderName, StringComparison.OrdinalIgnoreCase);

    private static bool IsForwardedHeader(string name) =>
        string.Equals(name, "Forwarded", StringComparison.OrdinalIgnoreCase) || name.StartsWith("X-Forwarded", StringComparison.OrdinalIgnoreCase);
}
