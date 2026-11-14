using System.Net.Http.Headers;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Moq;
using Tdn.Bff.Configuration;
using Tdn.Bff.Errors;
using Tdn.Bff.Security;
using Tdn.Bff.Sessions;
using Tdn.Bff.Upstream;
using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Transforms;
using Yarp.ReverseProxy.Transforms.Builder;

namespace bff_web.Tests.Upstream;

public sealed class GatewayMiddlewareAndHeaderTests
{
    [Fact]
    public void RequestFilteringIsCaseInsensitiveAndDeniesMandatoryHeadersEvenWhenAllowed()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://gateway.example/path?q=one%2Ftwo")
        {
            Content = new ByteArrayContent([1, 2, 3])
        };
        request.Headers.TryAddWithoutValidation("aCcEpT", "application/json");
        request.Headers.TryAddWithoutValidation("Idempotency-Key", "request-123");
        request.Headers.TryAddWithoutValidation("Authorization", "Bearer browser-token");
        request.Headers.TryAddWithoutValidation("Cookie", "secret=cookie");
        request.Headers.TryAddWithoutValidation("X-CsRf-ToKeN", "csrf-token");
        request.Headers.TryAddWithoutValidation("Forwarded", "for=spoofed");
        request.Headers.TryAddWithoutValidation("X-Forwarded-For", "spoofed");
        request.Headers.TryAddWithoutValidation("X-Subject", "spoofed-subject");
        request.Headers.Host = "browser.example";
        request.Content.Headers.TryAddWithoutValidation("Content-Type", "application/json");
        request.Content.Headers.TryAddWithoutValidation("X-Content-Metadata", "retained");
        var allowList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "accept", "IDEMPOTENCY-KEY", "authorization", "cookie", "x-csrf-token", "Forwarded", "X-Forwarded-For", "X-Subject", "Content-Type", "X-Content-Metadata"
        };

        GatewayHeaderTransforms.FilterRequestHeaders(request, allowList, "X-CSRF-TOKEN");

        Assert.True(request.Headers.Contains("aCcEpT"));
        Assert.Equal("request-123", request.Headers.GetValues("Idempotency-Key").Single());
        Assert.False(request.Headers.Contains("Authorization"));
        Assert.False(request.Headers.Contains("Cookie"));
        Assert.False(request.Headers.Contains("X-CSRF-TOKEN"));
        Assert.False(request.Headers.Contains("Forwarded"));
        Assert.False(request.Headers.Contains("X-Forwarded-For"));
        Assert.False(request.Headers.Contains("X-Subject"));
        Assert.Null(request.Headers.Host);
        Assert.Equal("application/json", request.Content.Headers.ContentType?.ToString());
        Assert.Equal("retained", request.Content.Headers.GetValues("X-Content-Metadata").Single());
    }

    [Fact]
    public void ResponseFilteringKeepsAllowlistedMetadataAndDropsCredentialsAndCsrf()
    {
        var headers = new HeaderDictionary
        {
            ["content-type"] = "application/json",
            ["ETag"] = "\"v1\"",
            ["Location"] = "/groups/1?view=full",
            ["X-Trace-Id"] = "trace-1",
            ["Set-Cookie"] = "session=secret",
            ["Authorization"] = "Bearer secret",
            ["Proxy-Authorization"] = "Basic secret",
            ["X-Account-Id"] = "account-secret",
            ["x-csrf-token"] = "csrf",
            ["X-Not-Allowed"] = "drop"
        };
        var allowList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Content-Type", "etag", "location", "x-trace-id", "Set-Cookie", "Authorization", "Proxy-Authorization", "X-Account-Id", "X-CSRF-TOKEN"
        };

        GatewayHeaderTransforms.FilterResponseHeaders(headers, allowList, "X-CSRF-TOKEN");

        Assert.Equal("application/json", headers["Content-Type"]);
        Assert.Equal("\"v1\"", headers["ETag"]);
        Assert.Equal("/groups/1?view=full", headers["Location"]);
        Assert.Equal("trace-1", headers["X-Trace-Id"]);
        Assert.False(headers.ContainsKey("Set-Cookie"));
        Assert.False(headers.ContainsKey("Authorization"));
        Assert.False(headers.ContainsKey("Proxy-Authorization"));
        Assert.False(headers.ContainsKey("X-Account-Id"));
        Assert.False(headers.ContainsKey("X-CSRF-TOKEN"));
        Assert.False(headers.ContainsKey("X-Not-Allowed"));
    }

    [Fact]
    public async Task SessionMiddlewareValidatesBeforeTokenAndRunsYarpRequestTransformWithServerBearer()
    {
        var context = new DefaultHttpContext();
        context.User = CreateAuthenticatedUser("session-key");
        var responseFeature = new TestHttpResponseFeature();
        context.Features.Set<IHttpResponseFeature>(responseFeature);
        context.Response.Body = new MemoryStream();
        context.Request.Method = HttpMethods.Post;
        var validator = new DelegateAntiforgeryValidator(_ => Task.CompletedTask);
        var tokenService = new StubTokenService("server-access-token");
        var builder = CreateTransformBuilder();
        GatewayHeaderTransforms.AddTransforms(builder);
        using var proxyRequest = new HttpRequestMessage(HttpMethod.Post, "https://gateway.example/groups?x=1")
        {
            Content = new ByteArrayContent([7, 8])
        };
        proxyRequest.Headers.TryAddWithoutValidation("Authorization", "Bearer browser-token");
        proxyRequest.Headers.TryAddWithoutValidation("Accept", "application/json");
        string? forwardedAuthorization = null;
        var middleware = new GatewaySessionMiddleware(async httpContext =>
        {
            Assert.Single(httpContext.Items);
            Assert.IsNotType<string>(httpContext.Items.Keys.Single());
            var transform = Assert.Single(builder.RequestTransforms);
            await transform.ApplyAsync(new RequestTransformContext { HttpContext = httpContext, ProxyRequest = proxyRequest });
            forwardedAuthorization = proxyRequest.Headers.Authorization?.ToString();
            await httpContext.Response.WriteAsync("gateway-body");
        });

        await middleware.InvokeAsync(context, validator, tokenService);

        Assert.Equal(1, validator.CallCount);
        Assert.Equal("session-key", tokenService.LastSessionKey);
        Assert.Equal("Bearer server-access-token", forwardedAuthorization);
        Assert.Equal("application/json", proxyRequest.Headers.GetValues("Accept").Single());
        Assert.Equal(HttpMethod.Post, proxyRequest.Method);
        Assert.Equal("https://gateway.example/groups?x=1", proxyRequest.RequestUri?.ToString());
        Assert.Equal(new byte[] { 7, 8 }, await proxyRequest.Content!.ReadAsByteArrayAsync());
        context.Response.Body.Position = 0;
        Assert.Equal("gateway-body", await new StreamReader(context.Response.Body).ReadToEndAsync());
        Assert.DoesNotContain("server-access-token", await ReadResponseTextAsync(context));
        await responseFeature.FireOnStartingAsync();
        Assert.NotEqual(0, responseFeature.CallbackCount);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
    }

    [Fact]
    public async Task SessionMiddlewareRejectsAnonymousRequestAndStopsBeforeTokenService()
    {
        var context = new DefaultHttpContext();
        var tokenService = new StubTokenService("unused");
        var middleware = new GatewaySessionMiddleware(_ => Task.CompletedTask);

        await Assert.ThrowsAsync<AuthenticationRequiredException>(() => middleware.InvokeAsync(context, new DelegateAntiforgeryValidator(_ => Task.CompletedTask), tokenService));

        Assert.Equal(0, tokenService.CallCount);
    }

    [Fact]
    public async Task SessionMiddlewareAntiforgeryFailureStopsBeforeRefreshAndForwarding()
    {
        var context = CreateAuthenticatedContext("session-key");
        context.Request.Method = HttpMethods.Post;
        var tokenService = new StubTokenService("unused");
        var nextCalled = false;
        var middleware = new GatewaySessionMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        await Assert.ThrowsAsync<AntiforgeryValidationException>(() => middleware.InvokeAsync(
            context,
            new DelegateAntiforgeryValidator(_ => throw new AntiforgeryValidationException("invalid")),
            tokenService));

        Assert.False(nextCalled);
        Assert.Equal(0, tokenService.CallCount);
    }

    [Fact]
    public async Task YarpResponseAndTrailerTransformsFilterAfterHeadersAreCopied()
    {
        var builder = CreateTransformBuilder();
        GatewayHeaderTransforms.AddTransforms(builder);
        var context = new DefaultHttpContext();
        context.Response.Headers["Content-Type"] = "application/json";
        context.Response.Headers["ETag"] = "\"v1\"";
        context.Response.Headers["Set-Cookie"] = "secret=value";
        var trailers = new TestTrailersFeature();
        trailers.Trailers["ETag"] = "\"trailer-v1\"";
        trailers.Trailers["Set-Cookie"] = "trailer=secret";
        context.Features.Set<IHttpResponseTrailersFeature>(trailers);
        using var proxyResponse = new HttpResponseMessage(System.Net.HttpStatusCode.OK);
        var responseTransform = Assert.Single(builder.ResponseTransforms);
        var trailerTransform = Assert.Single(builder.ResponseTrailersTransforms);

        await responseTransform.ApplyAsync(new ResponseTransformContext { HttpContext = context, ProxyResponse = proxyResponse, HeadersCopied = true });
        await trailerTransform.ApplyAsync(new ResponseTrailersTransformContext { HttpContext = context, ProxyResponse = proxyResponse, HeadersCopied = true });

        Assert.Equal("application/json", context.Response.Headers["Content-Type"]);
        Assert.Equal("\"v1\"", context.Response.Headers["ETag"]);
        Assert.False(context.Response.Headers.ContainsKey("Set-Cookie"));
        Assert.Equal("\"trailer-v1\"", trailers.Trailers["ETag"]);
        Assert.False(trailers.Trailers.ContainsKey("Set-Cookie"));
    }

    private static TransformBuilderContext CreateTransformBuilder()
    {
        var options = new BffOptions
        {
            Transport = new TransportOptions
            {
                RequestHeaders = ["Accept"],
                ResponseHeaders = ["Content-Type", "ETag"]
            }
        };
        var services = new ServiceCollection()
            .AddSingleton<IOptions<BffOptions>>(Options.Create(options))
            .AddSingleton<IOptions<AntiforgeryOptions>>(Options.Create(new AntiforgeryOptions { HeaderName = "X-CSRF-TOKEN" }))
            .BuildServiceProvider();
        return new TransformBuilderContext { Services = services, Route = new RouteConfig { RouteId = "unit" } };
    }

    private static DefaultHttpContext CreateAuthenticatedContext(string sessionKey)
    {
        var context = new DefaultHttpContext
        {
            User = CreateAuthenticatedUser(sessionKey)
        };
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static ClaimsPrincipal CreateAuthenticatedUser(string sessionKey)
    {
        var identity = new ClaimsIdentity("test");
        identity.AddClaim(new Claim(BffAuthenticationDefaults.SessionClaim, sessionKey));
        return new ClaimsPrincipal(identity);
    }

    private static async Task<string> ReadResponseTextAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return await new StreamReader(context.Response.Body).ReadToEndAsync();
    }

    private sealed class StubTokenService : ISessionTokenService
    {
        private readonly string _token;

        public StubTokenService(string token)
        {
            _token = token;
        }

        public int CallCount { get; private set; }
        public string? LastSessionKey { get; private set; }

        public Task<string> GetAccessTokenAsync(string sessionKey, CancellationToken cancellationToken)
        {
            CallCount++;
            LastSessionKey = sessionKey;
            return Task.FromResult(_token);
        }
    }

    private sealed class DelegateAntiforgeryValidator : IAntiforgeryRequestValidator
    {
        private readonly Func<HttpContext, Task> _validate;

        public DelegateAntiforgeryValidator(Func<HttpContext, Task> validate)
        {
            _validate = validate;
        }

        public int CallCount { get; private set; }

        public Task ValidateUnsafeRequestAsync(HttpContext context)
        {
            CallCount++;
            return _validate(context);
        }
    }

    private sealed class TestTrailersFeature : IHttpResponseTrailersFeature
    {
        public IHeaderDictionary Trailers { get; set; } = new HeaderDictionary();
    }

    private sealed class TestHttpResponseFeature : HttpResponseFeature
    {
        private readonly List<(Func<object, Task> Callback, object State)> _callbacks = [];

        public int CallbackCount => _callbacks.Count;

        public override void OnStarting(Func<object, Task> callback, object state)
        {
            _callbacks.Add((callback, state));
        }

        public async Task FireOnStartingAsync()
        {
            for (var index = _callbacks.Count - 1; index >= 0; index--)
                await _callbacks[index].Callback(_callbacks[index].State);
        }
    }
}
