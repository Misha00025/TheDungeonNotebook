using Microsoft.AspNetCore.Authentication;
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Sessions;

public sealed class SessionTokenServiceTests
{
    private static readonly DateTimeOffset Now = new(2030, 1, 2, 3, 4, 5, TimeSpan.Zero);

    [Fact]
    public async Task ReturnsFreshAccessTokenWithoutRefreshing()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddMinutes(2)));

        var token = await service.GetAccessTokenAsync("session", CancellationToken.None);

        Assert.Equal("access-old", token);
        Assert.Equal(0, client.RefreshCount);
    }

    [Fact]
    public async Task RefreshRotatesTokensAndPreservesAbsoluteSessionExpiry()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        var sessionExpiry = Now.AddHours(7);
        await SaveAsync(repository, TicketFactory.Create(sessionExpiry, Now.AddSeconds(5)));
        client.RefreshHandler = _ =>
        {
            timeProvider.Now = Now.AddSeconds(20);
            return Task.FromResult(new OidcTokenResponse(true, false, null, "access-new", "refresh-new", 300, null));
        };

        var token = await service.GetAccessTokenAsync("session", CancellationToken.None);
        var stored = await repository.GetAsync("session", CancellationToken.None);

        Assert.Equal("access-new", token);
        Assert.NotNull(stored);
        Assert.Equal(sessionExpiry, stored.Ticket.Properties.ExpiresUtc);
        Assert.Equal("refresh-new", stored.Ticket.Properties.GetTokenValue("refresh_token"));
        Assert.Equal("access-new", stored.Ticket.Properties.GetTokenValue("access_token"));
        Assert.Equal(Now.AddSeconds(320).ToString("O"), stored.Ticket.Properties.GetTokenValue("expires_at"));
        Assert.Equal(1, client.RefreshCount);
    }

    [Fact]
    public async Task MissingRotatedRefreshTokenKeepsPreviousRefreshToken()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5), refreshToken: "refresh-original"));
        client.RefreshHandler = _ => Task.FromResult(new OidcTokenResponse(true, false, null, "access-new", null, 300, null));

        await service.GetAccessTokenAsync("session", CancellationToken.None);
        var stored = await repository.GetAsync("session", CancellationToken.None);

        Assert.Equal("refresh-original", stored?.Ticket.Properties.GetTokenValue("refresh_token"));
    }

    [Fact]
    public async Task ParallelServicesShareSingleRefreshUnderLock()
    {
        var (first, repository, sessionLock, client, timeProvider) = CreateSystem();
        var second = TestOptions.TokenService(repository, sessionLock, client, timeProvider);
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5)));
        var refreshStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var finishRefresh = new TaskCompletionSource<OidcTokenResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        client.RefreshHandler = async cancellationToken =>
        {
            refreshStarted.TrySetResult(true);
            return await finishRefresh.Task.WaitAsync(cancellationToken);
        };

        var firstCall = first.GetAccessTokenAsync("session", CancellationToken.None);
        await refreshStarted.Task;
        var secondCall = second.GetAccessTokenAsync("session", CancellationToken.None);
        await sessionLock.SecondAcquireAttempted.Task;
        finishRefresh.SetResult(new OidcTokenResponse(true, false, null, "access-shared", "refresh-next", 300, null));

        var tokens = await Task.WhenAll(firstCall, secondCall);

        Assert.Equal(new[] { "access-shared", "access-shared" }, tokens);
        Assert.Equal(1, client.RefreshCount);
    }

    [Fact]
    public async Task LogoutDuringRefreshDoesNotResurrectSession()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5)));
        var refreshStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var finishRefresh = new TaskCompletionSource<OidcTokenResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        client.RefreshHandler = async cancellationToken =>
        {
            refreshStarted.TrySetResult(true);
            return await finishRefresh.Task.WaitAsync(cancellationToken);
        };

        var call = service.GetAccessTokenAsync("session", CancellationToken.None);
        await refreshStarted.Task;
        await repository.DeleteAsync("session", CancellationToken.None);
        finishRefresh.SetResult(new OidcTokenResponse(true, false, null, "access-new", "refresh-new", 300, null));

        await Assert.ThrowsAsync<AuthenticationRequiredException>(() => call);
        Assert.Null(await repository.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task InvalidGrantDeletesUnchangedSnapshotAndRequiresAuthentication()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5)));
        client.RefreshHandler = _ => Task.FromResult(new OidcTokenResponse(false, true, "invalid_grant", null, null, null, null));

        await Assert.ThrowsAsync<AuthenticationRequiredException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));

        Assert.Null(await repository.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task InvalidGrantCannotDeleteChangedSnapshot()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5)));
        client.RefreshHandler = async _ =>
        {
            repository.SetTicket("session", TicketFactory.Create(Now.AddHours(8), Now.AddMinutes(3), "fresh-access", "fresh-refresh"));
            return await Task.FromResult(new OidcTokenResponse(false, true, "invalid_grant", null, null, null, null));
        };

        var token = await service.GetAccessTokenAsync("session", CancellationToken.None);

        Assert.Equal("fresh-access", token);
        Assert.NotNull(await repository.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task RefreshDependencyAndInvalidResponsesDoNotDeleteSession()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5)));
        client.RefreshHandler = _ => throw new DependencyUnavailableException();

        await Assert.ThrowsAsync<DependencyUnavailableException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));
        Assert.NotNull(await repository.GetAsync("session", CancellationToken.None));

        client.RefreshHandler = _ => Task.FromResult(new OidcTokenResponse(true, false, null, null, null, 300, null));
        await Assert.ThrowsAsync<DependencyUnavailableException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));
        Assert.NotNull(await repository.GetAsync("session", CancellationToken.None));

        client.RefreshHandler = _ => Task.FromResult(new OidcTokenResponse(false, false, "invalid_scope", null, null, null, null));
        await Assert.ThrowsAsync<DependencyUnavailableException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));
        Assert.NotNull(await repository.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task IdentityProviderUnavailableDuringRefreshPreservesSession()
    {
        var (service, repository, _, client, _) = CreateSystem();
        var original = TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5));
        await SaveAsync(repository, original);
        client.RefreshHandler = _ => throw new IdentityProviderUnavailableException();

        await Assert.ThrowsAsync<IdentityProviderUnavailableException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));

        var stored = await repository.GetAsync("session", CancellationToken.None);
        Assert.NotNull(stored);
        Assert.Equal("access-old", stored.Ticket.Properties.GetTokenValue("access_token"));
        Assert.Equal("refresh-old", stored.Ticket.Properties.GetTokenValue("refresh_token"));
    }

    [Fact]
    public async Task MissingRefreshTokenReturnsLiveAccessButDeletesExpiredAccessConditionally()
    {
        var (service, repository, _, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(10), refreshToken: null));

        Assert.Equal("access-old", await service.GetAccessTokenAsync("session", CancellationToken.None));
        Assert.Equal(0, client.RefreshCount);

        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(-1), refreshToken: null));
        await Assert.ThrowsAsync<AuthenticationRequiredException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));
        Assert.Null(await repository.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task MissingOrExpiredSessionRequiresAuthentication()
    {
        var (service, repository, _, _, timeProvider) = CreateSystem();
        await Assert.ThrowsAsync<AuthenticationRequiredException>(() => service.GetAccessTokenAsync("missing", CancellationToken.None));
        await SaveAsync(repository, TicketFactory.Create(Now, Now.AddMinutes(1)));

        await Assert.ThrowsAsync<AuthenticationRequiredException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task LockTimeoutAndLostLeaseFailWithoutCommittingRefresh()
    {
        var (service, repository, sessionLock, client, timeProvider) = CreateSystem();
        await SaveAsync(repository, TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5)));
        sessionLock.ThrowTimeout = true;

        await Assert.ThrowsAsync<DependencyUnavailableException>(() => service.GetAccessTokenAsync("session", CancellationToken.None));
        Assert.Equal(0, client.RefreshCount);
        sessionLock.ThrowTimeout = false;

        var refreshStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        client.RefreshHandler = async cancellationToken =>
        {
            refreshStarted.TrySetResult(true);
            await new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously).Task.WaitAsync(cancellationToken);
            return new OidcTokenResponse(true, false, null, "unused", null, 300, null);
        };
        var call = service.GetAccessTokenAsync("session", CancellationToken.None);
        await refreshStarted.Task;
        sessionLock.LoseLatestLease();

        await Assert.ThrowsAsync<DependencyUnavailableException>(() => call);
        Assert.Equal("access-old", (await repository.GetAsync("session", CancellationToken.None))?.Ticket.Properties.GetTokenValue("access_token"));
    }

    private static (SessionTokenService Service, FakeSessionRepository Repository, FakeSessionLock Lock, FakeOidcTokenClient Client, FixedTimeProvider TimeProvider) CreateSystem()
    {
        var timeProvider = new FixedTimeProvider(Now);
        var repository = new FakeSessionRepository(timeProvider);
        var sessionLock = new FakeSessionLock();
        var client = new FakeOidcTokenClient();
        return (TestOptions.TokenService(repository, sessionLock, client, timeProvider), repository, sessionLock, client, timeProvider);
    }

    private static Task SaveAsync(FakeSessionRepository repository, AuthenticationTicket ticket) =>
        repository.CreateAsync("session", ticket, CancellationToken.None);
}
