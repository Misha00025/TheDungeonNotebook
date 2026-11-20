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
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;
using bff_web.Tests.Support;

namespace bff_web.Tests.Security;

public sealed class EndpointAndAntiforgeryTests
{
    [Fact]
    public async Task AnonymousSessionHasOnlyAgreedFieldsAndDoesNotRequestAntiforgeryToken()
    {
        var (context, authentication) = CreateContext();
        authentication.Setup(service => service.AuthenticateAsync(context, BffAuthenticationDefaults.Cookies)).ReturnsAsync(AuthenticateResult.NoResult());
        var antiforgery = new Mock<IAntiforgery>();
        var tokenService = new Mock<ISessionTokenService>();

        await BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN", tokenService.Object);

        using var document = await ReadJsonAsync(context);
        Assert.Equal(new[] { "authenticated", "csrfHeaderName", "csrfToken" }, document.RootElement.EnumerateObject().Select(property => property.Name).OrderBy(name => name).ToArray());
        Assert.False(document.RootElement.GetProperty("authenticated").GetBoolean());
        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("csrfToken").ValueKind);
        Assert.Equal("X-CSRF-TOKEN", document.RootElement.GetProperty("csrfHeaderName").GetString());
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        antiforgery.Verify(service => service.GetAndStoreTokens(It.IsAny<HttpContext>()), Times.Never);
        tokenService.Verify(service => service.GetAccessTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AuthenticatedSessionReturnsOnlyTokenContractFields()
    {
        var (context, authentication) = CreateContext();
        var principal = PrincipalWithSession("server-key");
        authentication.Setup(service => service.AuthenticateAsync(context, BffAuthenticationDefaults.Cookies))
            .ReturnsAsync(AuthenticateResult.Success(new AuthenticationTicket(principal, new AuthenticationProperties(), BffAuthenticationDefaults.Cookies)));
        var antiforgery = new Mock<IAntiforgery>();
        var tokenService = new Mock<ISessionTokenService>();
        tokenService.Setup(service => service.GetAccessTokenAsync("server-key", It.IsAny<CancellationToken>())).ReturnsAsync("server-access-token");
        antiforgery.Setup(service => service.GetAndStoreTokens(context))
            .Returns(new AntiforgeryTokenSet("csrf-token-value", "cookie-token", "field", "X-CSRF-TOKEN"));

        await BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN", tokenService.Object);

        using var document = await ReadJsonAsync(context);
        var names = document.RootElement.EnumerateObject().Select(property => property.Name).OrderBy(name => name).ToArray();
        Assert.Equal(new[] { "authenticated", "csrfHeaderName", "csrfToken" }, names);
        var json = document.RootElement.GetRawText();
        Assert.DoesNotContain("access_token", json);
        Assert.DoesNotContain("server-key", json);
        Assert.DoesNotContain("subject", json);
        Assert.DoesNotContain("server-access-token", json);
        Assert.Equal("csrf-token-value", document.RootElement.GetProperty("csrfToken").GetString());
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        tokenService.Verify(service => service.GetAccessTokenAsync("server-key", context.RequestAborted), Times.Once);
    }

    [Fact]
    public async Task SessionRefreshesExpiredAccessAndReturnsOnlySessionContractFields()
    {
        var now = new DateTimeOffset(2032, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var repository = new FakeSessionRepository(timeProvider);
        var sessionLock = new FakeSessionLock();
        var client = new FakeOidcTokenClient
        {
            RefreshHandler = _ => Task.FromResult(new OidcTokenResponse(true, false, null, "rotated-secret-access", "rotated-secret-refresh", 300, null))
        };
        var service = TestOptions.TokenService(repository, sessionLock, client, timeProvider);
        await repository.CreateAsync("exact-session", TicketFactory.Create(now.AddDays(31), now.AddSeconds(-1)), CancellationToken.None);
        var (context, authentication) = CreateContext();
        var principal = PrincipalWithSession("exact-session");
        authentication.Setup(authenticationService => authenticationService.AuthenticateAsync(context, BffAuthenticationDefaults.Cookies))
            .ReturnsAsync(AuthenticateResult.Success(new AuthenticationTicket(principal, new AuthenticationProperties(), BffAuthenticationDefaults.Cookies)));
        var antiforgery = new Mock<IAntiforgery>();
        antiforgery.Setup(provider => provider.GetAndStoreTokens(context)).Returns(new AntiforgeryTokenSet("csrf-value", "cookie", "field", "X-CSRF-TOKEN"));

        await BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN", service);

        using var document = await ReadJsonAsync(context);
        Assert.Equal(new[] { "authenticated", "csrfHeaderName", "csrfToken" }, document.RootElement.EnumerateObject().Select(property => property.Name).OrderBy(name => name).ToArray());
        Assert.True(document.RootElement.GetProperty("authenticated").GetBoolean());
        var json = document.RootElement.GetRawText();
        Assert.DoesNotContain("rotated-secret-access", json);
        Assert.DoesNotContain("rotated-secret-refresh", json);
        Assert.Equal("rotated-secret-access", (await repository.GetAsync("exact-session", CancellationToken.None))?.Ticket.Properties.GetTokenValue("access_token"));
    }

    [Fact]
    public async Task SessionAuthenticationRequiredSignsOutCookieAndReturnsAnonymousContractWithoutAntiforgery()
    {
        var (context, authentication) = CreateContext();
        authentication.Setup(service => service.AuthenticateAsync(context, BffAuthenticationDefaults.Cookies))
            .ReturnsAsync(AuthenticateResult.Success(new AuthenticationTicket(PrincipalWithSession("session"), new AuthenticationProperties(), BffAuthenticationDefaults.Cookies)));
        authentication.Setup(service => service.SignOutAsync(context, BffAuthenticationDefaults.Cookies, It.IsAny<AuthenticationProperties?>())).Returns(Task.CompletedTask);
        var antiforgery = new Mock<IAntiforgery>();
        var tokenService = new Mock<ISessionTokenService>();
        tokenService.Setup(service => service.GetAccessTokenAsync("session", It.IsAny<CancellationToken>())).ThrowsAsync(new AuthenticationRequiredException());

        await BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN", tokenService.Object);

        using var document = await ReadJsonAsync(context);
        Assert.False(document.RootElement.GetProperty("authenticated").GetBoolean());
        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("csrfToken").ValueKind);
        Assert.Equal(new[] { "authenticated", "csrfHeaderName", "csrfToken" }, document.RootElement.EnumerateObject().Select(property => property.Name).OrderBy(name => name).ToArray());
        authentication.Verify(service => service.SignOutAsync(context, BffAuthenticationDefaults.Cookies, It.IsAny<AuthenticationProperties?>()), Times.Once);
        antiforgery.Verify(service => service.GetAndStoreTokens(It.IsAny<HttpContext>()), Times.Never);
    }

    [Theory]
    [MemberData(nameof(SessionDependencyFailures))]
    public async Task SessionDependencyFailuresPropagateWithoutSigningOut(Exception exception)
    {
        var (context, authentication) = CreateContext();
        authentication.Setup(service => service.AuthenticateAsync(context, BffAuthenticationDefaults.Cookies))
            .ReturnsAsync(AuthenticateResult.Success(new AuthenticationTicket(PrincipalWithSession("session"), new AuthenticationProperties(), BffAuthenticationDefaults.Cookies)));
        var antiforgery = new Mock<IAntiforgery>();
        var tokenService = new Mock<ISessionTokenService>();
        tokenService.Setup(service => service.GetAccessTokenAsync("session", It.IsAny<CancellationToken>())).ThrowsAsync(exception);

        if (exception is DependencyUnavailableException)
            await Assert.ThrowsAsync<DependencyUnavailableException>(() => BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN", tokenService.Object));
        else
            await Assert.ThrowsAsync<IdentityProviderUnavailableException>(() => BffEndpointRouteBuilderExtensions.HandleSessionAsync(context, antiforgery.Object, "X-CSRF-TOKEN", tokenService.Object));

        authentication.Verify(service => service.SignOutAsync(It.IsAny<HttpContext>(), It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()), Times.Never);
        antiforgery.Verify(service => service.GetAndStoreTokens(It.IsAny<HttpContext>()), Times.Never);
        Assert.Equal(0, context.Response.Body.Length);
    }

    public static IEnumerable<object[]> SessionDependencyFailures =>
    [
        [new DependencyUnavailableException()],
        [new IdentityProviderUnavailableException()]
    ];

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

    [Fact]
    public async Task LoginUsesConfiguredPublicOriginForLocalReturnUrl()
    {
        var (context, authentication) = CreateContext();
        AuthenticationProperties? challengeProperties = null;
        authentication.Setup(service => service.ChallengeAsync(context, BffAuthenticationDefaults.Oidc, It.IsAny<AuthenticationProperties?>()))
            .Callback<HttpContext, string?, AuthenticationProperties?>((_, _, properties) => challengeProperties = properties)
            .Returns(Task.CompletedTask);

        await BffEndpointRouteBuilderExtensions.HandleLoginAsync(context, "~/groups?tab=active#notes", new UrlHelperFactory(), "https://hub.example:8443/");

        Assert.Equal("https://hub.example:8443/groups?tab=active#notes", challengeProperties?.RedirectUri);
    }

    [Fact]
    public async Task LoginUsesConfiguredPublicOriginForRootAndRejectsExternalReturnUrl()
    {
        var (context, authentication) = CreateContext();
        AuthenticationProperties? challengeProperties = null;
        authentication.Setup(service => service.ChallengeAsync(context, BffAuthenticationDefaults.Oidc, It.IsAny<AuthenticationProperties?>()))
            .Callback<HttpContext, string?, AuthenticationProperties?>((_, _, properties) => challengeProperties = properties)
            .Returns(Task.CompletedTask);

        await BffEndpointRouteBuilderExtensions.HandleLoginAsync(context, null, new UrlHelperFactory(), "https://hub.example");
        Assert.Equal("https://hub.example/", challengeProperties?.RedirectUri);

        var (invalidContext, invalidAuthentication) = CreateContext();
        await BffEndpointRouteBuilderExtensions.HandleLoginAsync(invalidContext, "https://evil.example/path", new UrlHelperFactory(), "https://hub.example");
        Assert.Equal(StatusCodes.Status400BadRequest, invalidContext.Response.StatusCode);
        invalidAuthentication.Verify(service => service.ChallengeAsync(It.IsAny<HttpContext>(), It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()), Times.Never);
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
    public async Task LogoutValidatesCsrfBeforeSigningOutCookieThenOidcScheme()
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
        authentication.Setup(service => service.SignOutAsync(context, BffAuthenticationDefaults.Oidc, It.IsAny<AuthenticationProperties?>()))
            .Callback<HttpContext, string?, AuthenticationProperties?>((_, _, _) => order.Add("oidc"))
            .Returns(Task.CompletedTask);

        await BffEndpointRouteBuilderExtensions.HandleLogoutAsync(context, validator);

        Assert.Equal(new[] { "validate", "signout", "oidc" }, order);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        authentication.Verify(service => service.SignOutAsync(context, BffAuthenticationDefaults.Oidc, It.Is<AuthenticationProperties?>(properties => properties!.RedirectUri == "/login")), Times.Once);
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
    public async Task LogoutKeepsCookieRemovalWhenOidcSignOutFails()
    {
        var (context, authentication) = CreateContext();
        var order = new List<string>();
        authentication.Setup(service => service.SignOutAsync(context, BffAuthenticationDefaults.Cookies, It.IsAny<AuthenticationProperties?>()))
            .Callback(() => order.Add("cookie"))
            .Returns(Task.CompletedTask);
        authentication.Setup(service => service.SignOutAsync(context, BffAuthenticationDefaults.Oidc, It.IsAny<AuthenticationProperties?>()))
            .Callback(() => order.Add("oidc"))
            .ThrowsAsync(new InvalidOperationException("discovery failed"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => BffEndpointRouteBuilderExtensions.HandleLogoutAsync(context, new DelegateAntiforgeryValidator(_ => Task.CompletedTask)));

        Assert.Equal(new[] { "cookie", "oidc" }, order);
    }

    [Fact]
    public async Task LogoutContinuationConsumesOpaqueRequestAndRedirectsOnce()
    {
        var store = new FakeLogoutRedirectStore();
        var request = await store.StoreAsync("https://idp.example/logout?id_token_hint=secret", CancellationToken.None);
        var context = new DefaultHttpContext();
        context.Request.QueryString = new QueryString($"?request={request}");

        await BffEndpointRouteBuilderExtensions.HandleLogoutContinuationAsync(context, store);

        Assert.Equal("https://idp.example/logout?id_token_hint=secret", context.Response.Headers.Location);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        Assert.Equal("no-referrer", context.Response.Headers["Referrer-Policy"]);
        var missing = new DefaultHttpContext { RequestServices = context.RequestServices };
        missing.Request.QueryString = new QueryString($"?request={request}");
        missing.Response.Body = new MemoryStream();
        await BffEndpointRouteBuilderExtensions.HandleLogoutContinuationAsync(missing, store);
        Assert.Equal(StatusCodes.Status400BadRequest, missing.Response.StatusCode);
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
