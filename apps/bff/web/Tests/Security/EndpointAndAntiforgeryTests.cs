using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Tdn.Bff.Endpoints;
using Tdn.Bff.Security;
using Tdn.Bff.Sessions;

namespace bff_web.Tests.Security;

public sealed class EndpointAndAntiforgeryTests
{
    [Fact]
    public async Task AnonymousSessionHasOnlyAgreedFieldsAndDoesNotRequestAntiforgeryToken()
    {
        var (context, authentication) = CreateContext();
        authentication.Setup(service => service.AuthenticateAsync(context, BffAuthenticationDefaults.Cookies)).ReturnsAsync(AuthenticateResult.NoResult());
        var antiforgery = new Mock<IAntiforgery>();

        await BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN");

        using var document = await ReadJsonAsync(context);
        Assert.Equal(new[] { "authenticated", "csrfHeaderName", "csrfToken" }, document.RootElement.EnumerateObject().Select(property => property.Name).OrderBy(name => name).ToArray());
        Assert.False(document.RootElement.GetProperty("authenticated").GetBoolean());
        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("csrfToken").ValueKind);
        Assert.Equal("X-CSRF-TOKEN", document.RootElement.GetProperty("csrfHeaderName").GetString());
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        antiforgery.Verify(service => service.GetAndStoreTokens(It.IsAny<HttpContext>()), Times.Never);
    }

    [Fact]
    public async Task AuthenticatedSessionReturnsOnlyTokenContractFields()
    {
        var (context, authentication) = CreateContext();
        var principal = PrincipalWithSession("server-key");
        authentication.Setup(service => service.AuthenticateAsync(context, BffAuthenticationDefaults.Cookies))
            .ReturnsAsync(AuthenticateResult.Success(new AuthenticationTicket(principal, new AuthenticationProperties(), BffAuthenticationDefaults.Cookies)));
        var antiforgery = new Mock<IAntiforgery>();
        antiforgery.Setup(service => service.GetAndStoreTokens(context))
            .Returns(new AntiforgeryTokenSet("csrf-token-value", "cookie-token", "field", "X-CSRF-TOKEN"));

        await BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN");

        using var document = await ReadJsonAsync(context);
        var names = document.RootElement.EnumerateObject().Select(property => property.Name).OrderBy(name => name).ToArray();
        Assert.Equal(new[] { "authenticated", "csrfHeaderName", "csrfToken" }, names);
        var json = document.RootElement.GetRawText();
        Assert.DoesNotContain("access_token", json);
        Assert.DoesNotContain("server-key", json);
        Assert.DoesNotContain("subject", json);
        Assert.Equal("csrf-token-value", document.RootElement.GetProperty("csrfToken").GetString());
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
    }

    [Theory]
    [InlineData("/campaigns?tab=active#notes", "/campaigns?tab=active#notes")]
    [InlineData("~/groups?sort=name#recent", "/groups?sort=name#recent")]
    public async Task LoginChallengesOnlyOidcAndKeepsLocalReturnUrl(string returnUrl, string expectedRedirect)
    {
        var (context, authentication) = CreateContext();
        string? challengedScheme = null;
        AuthenticationProperties? challengedProperties = null;
        authentication.Setup(service => service.ChallengeAsync(context, It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()))
            .Callback<HttpContext, string?, AuthenticationProperties?>((_, scheme, properties) =>
            {
                challengedScheme = scheme;
                challengedProperties = properties;
            })
            .Returns(Task.CompletedTask);

        await BffEndpointRouteBuilderExtensions.HandleLoginAsync(context, returnUrl, new UrlHelperFactory());

        Assert.Equal(BffAuthenticationDefaults.Oidc, challengedScheme);
        Assert.Equal(expectedRedirect, challengedProperties?.RedirectUri);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
    }

    [Fact]
    public async Task LoginDefaultsReturnUrlToRoot()
    {
        var (context, authentication) = CreateContext();
        AuthenticationProperties? challengeProperties = null;
        authentication.Setup(service => service.ChallengeAsync(context, BffAuthenticationDefaults.Oidc, It.IsAny<AuthenticationProperties?>()))
            .Callback<HttpContext, string?, AuthenticationProperties?>((_, _, properties) => challengeProperties = properties)
            .Returns(Task.CompletedTask);

        await BffEndpointRouteBuilderExtensions.HandleLoginAsync(context, null, new UrlHelperFactory());

        Assert.Equal("/", challengeProperties?.RedirectUri);
    }

    [Theory]
    [InlineData("//evil.example")]
    [InlineData("/\\evil.example")]
    [InlineData("https://evil.example/path")]
    [InlineData("/path\u0001hidden")]
    public async Task LoginRejectsNonLocalReturnUrls(string returnUrl)
    {
        var (context, authentication) = CreateContext();

        await BffEndpointRouteBuilderExtensions.HandleLoginAsync(context, returnUrl, new UrlHelperFactory());

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        using var document = await ReadJsonAsync(context);
        Assert.Equal("invalid_return_url", document.RootElement.GetProperty("code").GetString());
        authentication.Verify(service => service.ChallengeAsync(It.IsAny<HttpContext>(), It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()), Times.Never);
    }

    [Fact]
    public async Task LogoutValidatesCsrfBeforeSigningOutOnlyCookieScheme()
    {
        var (context, authentication) = CreateContext();
        var order = new List<string>();
        var validator = new DelegateAntiforgeryValidator(_ =>
        {
            order.Add("validate");
            return Task.CompletedTask;
        });
        authentication.Setup(service => service.SignOutAsync(context, BffAuthenticationDefaults.Cookies, It.IsAny<AuthenticationProperties?>()))
            .Callback<HttpContext, string?, AuthenticationProperties?>((_, _, _) => order.Add("signout"))
            .Returns(Task.CompletedTask);

        await BffEndpointRouteBuilderExtensions.HandleLogoutAsync(context, validator);

        Assert.Equal(new[] { "validate", "signout" }, order);
        Assert.Equal(StatusCodes.Status204NoContent, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        authentication.Verify(service => service.SignOutAsync(context, BffAuthenticationDefaults.Oidc, It.IsAny<AuthenticationProperties?>()), Times.Never);
    }

    [Fact]
    public async Task LogoutAntiforgeryFailureDoesNotSignOut()
    {
        var (context, authentication) = CreateContext();
        var validator = new DelegateAntiforgeryValidator(_ => throw new AntiforgeryValidationException("invalid"));

        await Assert.ThrowsAsync<AntiforgeryValidationException>(() => BffEndpointRouteBuilderExtensions.HandleLogoutAsync(context, validator));

        authentication.Verify(service => service.SignOutAsync(It.IsAny<HttpContext>(), It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()), Times.Never);
    }

    [Fact]
    public void AntiforgeryAdditionalDataIsBoundToExactSessionClaim()
    {
        var provider = new SessionAntiforgeryAdditionalDataProvider();
        var context = new DefaultHttpContext { User = PrincipalWithSession("session-a") };

        var additionalData = provider.GetAdditionalData(context);

        Assert.Equal("session-a", additionalData);
        Assert.True(provider.ValidateAdditionalData(context, "session-a"));
        context.User = PrincipalWithSession("session-b");
        Assert.False(provider.ValidateAdditionalData(context, additionalData));
        Assert.False(provider.ValidateAdditionalData(new DefaultHttpContext(), "session-a"));
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    public async Task AntiforgeryRequestValidatorValidatesUnsafeMethods(string method)
    {
        var antiforgery = new Mock<IAntiforgery>();
        antiforgery.Setup(service => service.ValidateRequestAsync(It.IsAny<HttpContext>())).Returns(Task.CompletedTask);
        var validator = new AntiforgeryRequestValidator(antiforgery.Object);
        var context = new DefaultHttpContext();
        context.Request.Method = method;

        await validator.ValidateUnsafeRequestAsync(context);

        antiforgery.Verify(service => service.ValidateRequestAsync(context), Times.Once);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("HEAD")]
    [InlineData("OPTIONS")]
    [InlineData("TRACE")]
    public async Task AntiforgeryRequestValidatorSkipsSafeMethods(string method)
    {
        var antiforgery = new Mock<IAntiforgery>();
        var validator = new AntiforgeryRequestValidator(antiforgery.Object);
        var context = new DefaultHttpContext();
        context.Request.Method = method;

        await validator.ValidateUnsafeRequestAsync(context);

        antiforgery.Verify(service => service.ValidateRequestAsync(It.IsAny<HttpContext>()), Times.Never);
    }

    private static (DefaultHttpContext Context, Mock<IAuthenticationService> Authentication) CreateContext()
    {
        var authentication = new Mock<IAuthenticationService>();
        var services = new ServiceCollection().AddSingleton(authentication.Object).BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        return (context, authentication);
    }

    private static ClaimsPrincipal PrincipalWithSession(string sessionKey)
    {
        var identity = new ClaimsIdentity("test");
        identity.AddClaim(new Claim("sub", "subject"));
        identity.AddClaim(new Claim(BffAuthenticationDefaults.SessionClaim, sessionKey));
        return new ClaimsPrincipal(identity);
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return await JsonDocument.ParseAsync(context.Response.Body);
    }

    private sealed class DelegateAntiforgeryValidator : IAntiforgeryRequestValidator
    {
        private readonly Func<HttpContext, Task> _validate;

        public DelegateAntiforgeryValidator(Func<HttpContext, Task> validate)
        {
            _validate = validate;
        }

        public Task ValidateUnsafeRequestAsync(HttpContext context) => _validate(context);
    }
}
