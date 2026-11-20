using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Tdn.Bff.Errors;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Sessions;

public sealed class RedisTicketStoreTests
{
    private static readonly DateTimeOffset Now = new(2030, 2, 3, 4, 5, 6, TimeSpan.Zero);

    [Fact]
    public async Task StoreCreatesDistinctOpaqueKeysAndAddsServerSessionClaim()
    {
        var time = new FixedTimeProvider(Now);
        var repository = new FakeSessionRepository(time);
        var store = CreateStore(repository, new FakeSessionLock(), time);
        var source = TicketFactory.Create(Now.AddDays(31), Now.AddMinutes(2));

        var firstKey = await store.StoreAsync(source);
        var secondKey = await store.StoreAsync(source);
        var first = await store.RetrieveAsync(firstKey);

        Assert.NotEqual(firstKey, secondKey);
        Assert.Equal(43, firstKey.Length);
        Assert.Equal(firstKey, first?.Principal.FindFirst(BffAuthenticationDefaults.SessionClaim)?.Value);
        Assert.Null(source.Principal.FindFirst(BffAuthenticationDefaults.SessionClaim));
        Assert.Equal("access-old", first?.Properties.GetTokenValue("access_token"));
    }

    [Fact]
    public async Task RenewalAfterTwentyOneDaysExtendsToThirtyOneDaysFromNow()
    {
        var time = new FixedTimeProvider(Now);
        var repository = new FakeSessionRepository(time);
        var store = CreateStore(repository, new FakeSessionLock(), time);
        var key = await store.StoreAsync(CreateTicket(Now, Now.AddDays(31), "old-access", "old-refresh"));
        time.Now = Now.AddDays(21);
        var renewal = CreateTicket(time.Now, time.Now.AddDays(31), "stale-access", "stale-refresh");

        await store.RenewAsync(key, renewal);

        var stored = await store.RetrieveAsync(key);
        Assert.Equal(time.Now.AddDays(31), stored?.Properties.ExpiresUtc);
        Assert.Equal(time.Now, stored?.Properties.IssuedUtc);
        Assert.Equal("old-access", stored?.Properties.GetTokenValue("access_token"));
        Assert.Equal("old-refresh", stored?.Properties.GetTokenValue("refresh_token"));
    }

    [Fact]
    public async Task WeeklyRenewalsKeepSessionAliveForSeveralMonthsWithoutAbsoluteAgeLimit()
    {
        var time = new FixedTimeProvider(Now);
        var repository = new FakeSessionRepository(time);
        var store = CreateStore(repository, new FakeSessionLock(), time);
        var key = await store.StoreAsync(CreateTicket(Now, Now.AddDays(31), "access", "refresh"));

        for (var day = 7; day <= 210; day += 7)
        {
            time.Now = Now.AddDays(day);
            await store.RenewAsync(key, CreateTicket(time.Now, time.Now.AddDays(31), "stale-access", "stale-refresh"));
            Assert.Equal(time.Now.AddDays(31), (await store.RetrieveAsync(key))?.Properties.ExpiresUtc);
        }
    }

    [Fact]
    public async Task OldIncomingRenewalDoesNotShortenCurrentExpiryOrOverwriteCurrentTicketData()
    {
        var time = new FixedTimeProvider(Now);
        var repository = new FakeSessionRepository(time);
        var store = CreateStore(repository, new FakeSessionLock(), time);
        var current = CreateTicket(Now.AddDays(-1), Now.AddDays(40), "fresh-access", "fresh-refresh", "fresh-subject");
        current.Properties.IsPersistent = true;
        current.Properties.Items["fresh-property"] = "retained";
        await repository.CreateAsync("session", current, CancellationToken.None);
        var stale = CreateTicket(Now.AddDays(-14), Now.AddDays(17), "stale-access", "stale-refresh", "stale-subject");

        await store.RenewAsync("session", stale);

        var stored = await store.RetrieveAsync("session");
        Assert.Equal(Now.AddDays(40), stored?.Properties.ExpiresUtc);
        Assert.Equal(Now.AddDays(-1), stored?.Properties.IssuedUtc);
        Assert.Equal("fresh-access", stored?.Properties.GetTokenValue("access_token"));
        Assert.Equal("fresh-refresh", stored?.Properties.GetTokenValue("refresh_token"));
        Assert.Equal("fresh-subject", stored?.Principal.FindFirst("sub")?.Value);
        Assert.Equal("retained", stored?.Properties.Items["fresh-property"]);
    }

    [Fact]
    public async Task RenewalDoesNotRestoreDeletedOrExpiredSession()
    {
        var time = new FixedTimeProvider(Now);
        var repository = new FakeSessionRepository(time);
        var sessionLock = new FakeSessionLock();
        var store = CreateStore(repository, sessionLock, time);
        var incoming = CreateTicket(Now, Now.AddDays(31), "stale-access", "stale-refresh");
        await store.RenewAsync("missing", incoming);
        Assert.Null(await store.RetrieveAsync("missing"));

        await repository.CreateAsync("expired", CreateTicket(Now.AddDays(-32), Now.AddDays(-1), "access", "refresh"), CancellationToken.None);
        await store.RenewAsync("expired", incoming);
        Assert.Null(await store.RetrieveAsync("expired"));

        await repository.CreateAsync("deleted", CreateTicket(Now, Now.AddDays(3), "access", "refresh"), CancellationToken.None);
        await store.RemoveAsync("deleted");
        await store.RenewAsync("deleted", incoming);
        Assert.Null(await store.RetrieveAsync("deleted"));
    }

    [Fact]
    public async Task LockTimeoutDoesNotWriteRenewal()
    {
        var time = new FixedTimeProvider(Now);
        var repository = new FakeSessionRepository(time);
        var sessionLock = new FakeSessionLock { ThrowTimeout = true };
        var store = CreateStore(repository, sessionLock, time);
        var ticket = CreateTicket(Now, Now.AddDays(10), "access", "refresh");
        await repository.CreateAsync("session", ticket, CancellationToken.None);

        await Assert.ThrowsAsync<DependencyUnavailableException>(() =>
            store.RenewAsync("session", CreateTicket(Now, Now.AddDays(31), "stale", "stale")));

        Assert.Equal(Now.AddDays(10), (await repository.GetAsync("session", CancellationToken.None))?.Ticket.Properties.ExpiresUtc);
    }

    [Fact]
    public async Task LostLeaseDoesNotWriteRenewal()
    {
        var time = new FixedTimeProvider(Now);
        var inner = new FakeSessionRepository(time);
        var sessionLock = new FakeSessionLock();
        var repository = new ReplaceHookRepository(inner, () =>
        {
            sessionLock.LoseLatestLease();
            return Task.CompletedTask;
        });
        var store = new RedisTicketStore(repository, sessionLock, time);
        await inner.CreateAsync("session", CreateTicket(Now, Now.AddDays(10), "access", "refresh"), CancellationToken.None);

        await Assert.ThrowsAsync<DependencyUnavailableException>(() =>
            store.RenewAsync("session", CreateTicket(Now, Now.AddDays(31), "stale", "stale")));

        Assert.Equal(Now.AddDays(10), (await inner.GetAsync("session", CancellationToken.None))?.Ticket.Properties.ExpiresUtc);
    }

    [Fact]
    public async Task DeletionDuringCompareAndSetDoesNotRestoreSession()
    {
        var time = new FixedTimeProvider(Now);
        var inner = new FakeSessionRepository(time);
        var repository = new ReplaceHookRepository(inner, () => inner.DeleteAsync("session", CancellationToken.None));
        var store = new RedisTicketStore(repository, new FakeSessionLock(), time);
        await inner.CreateAsync("session", CreateTicket(Now, Now.AddDays(10), "access", "refresh"), CancellationToken.None);

        await store.RenewAsync("session", CreateTicket(Now, Now.AddDays(31), "stale", "stale"));

        Assert.Null(await inner.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task CompareAndSetConflictReReadsAndMergesLatestSnapshot()
    {
        var time = new FixedTimeProvider(Now);
        var repository = new ReplaceConflictRepository(new FakeSessionRepository(time));
        var store = CreateStore(repository, new FakeSessionLock(), time);
        await repository.CreateAsync("session", CreateTicket(Now, Now.AddDays(10), "access", "refresh"), CancellationToken.None);
        repository.OnFirstConflict = async () =>
            await repository.SetTicketAsync("session", CreateTicket(Now, Now.AddDays(22), "rotated-access", "rotated-refresh", "rotated-subject"));

        await store.RenewAsync("session", CreateTicket(Now, Now.AddDays(31), "stale-access", "stale-refresh"));

        var stored = await repository.GetAsync("session", CancellationToken.None);
        Assert.Equal(2, repository.ReplaceCount);
        Assert.Equal(Now.AddDays(31), stored?.Ticket.Properties.ExpiresUtc);
        Assert.Equal("rotated-access", stored?.Ticket.Properties.GetTokenValue("access_token"));
        Assert.Equal("rotated-refresh", stored?.Ticket.Properties.GetTokenValue("refresh_token"));
        Assert.Equal("rotated-subject", stored?.Ticket.Principal.FindFirst("sub")?.Value);
    }

    private static RedisTicketStore CreateStore(ISessionRepository repository, FakeSessionLock sessionLock, TimeProvider timeProvider) =>
        new(repository, sessionLock, timeProvider);

    private static AuthenticationTicket CreateTicket(DateTimeOffset issued, DateTimeOffset expires, string access, string refresh, string subject = "subject")
    {
        var identity = new ClaimsIdentity("test");
        identity.AddClaim(new Claim("sub", subject));
        var properties = new AuthenticationProperties { IssuedUtc = issued, ExpiresUtc = expires };
        properties.StoreTokens(
        [
            new AuthenticationToken { Name = "access_token", Value = access },
            new AuthenticationToken { Name = "refresh_token", Value = refresh }
        ]);
        return new AuthenticationTicket(new ClaimsPrincipal(identity), properties, BffAuthenticationDefaults.Cookies);
    }

    private sealed class ReplaceConflictRepository : ISessionRepository
    {
        private readonly FakeSessionRepository _inner;
        private bool _conflict = true;

        public ReplaceConflictRepository(FakeSessionRepository inner) => _inner = inner;

        public Func<Task>? OnFirstConflict { get; set; }
        public int ReplaceCount { get; private set; }

        public Task<SessionSnapshot?> GetAsync(string key, CancellationToken cancellationToken) => _inner.GetAsync(key, cancellationToken);
        public Task CreateAsync(string key, AuthenticationTicket ticket, CancellationToken cancellationToken) => _inner.CreateAsync(key, ticket, cancellationToken);
        public Task<bool> DeleteIfUnchangedAsync(string key, SessionSnapshot expectedSnapshot, CancellationToken cancellationToken) => _inner.DeleteIfUnchangedAsync(key, expectedSnapshot, cancellationToken);
        public Task DeleteAsync(string key, CancellationToken cancellationToken) => _inner.DeleteAsync(key, cancellationToken);

        public async Task<bool> ReplaceAsync(string key, SessionSnapshot expectedSnapshot, AuthenticationTicket replacementTicket, CancellationToken cancellationToken)
        {
            ReplaceCount++;
            if (_conflict)
            {
                _conflict = false;
                if (OnFirstConflict is not null)
                    await OnFirstConflict();
                return false;
            }
            return await _inner.ReplaceAsync(key, expectedSnapshot, replacementTicket, cancellationToken);
        }

        public Task SetTicketAsync(string key, AuthenticationTicket ticket)
        {
            _inner.SetTicket(key, ticket);
            return Task.CompletedTask;
        }
    }

    private sealed class ReplaceHookRepository : ISessionRepository
    {
        private readonly FakeSessionRepository _inner;
        private readonly Func<Task> _beforeReplace;
        private bool _hookPending = true;

        public ReplaceHookRepository(FakeSessionRepository inner, Func<Task> beforeReplace)
        {
            _inner = inner;
            _beforeReplace = beforeReplace;
        }

        public Task<SessionSnapshot?> GetAsync(string key, CancellationToken cancellationToken) => _inner.GetAsync(key, cancellationToken);
        public Task CreateAsync(string key, AuthenticationTicket ticket, CancellationToken cancellationToken) => _inner.CreateAsync(key, ticket, cancellationToken);
        public Task<bool> DeleteIfUnchangedAsync(string key, SessionSnapshot expectedSnapshot, CancellationToken cancellationToken) => _inner.DeleteIfUnchangedAsync(key, expectedSnapshot, cancellationToken);
        public Task DeleteAsync(string key, CancellationToken cancellationToken) => _inner.DeleteAsync(key, cancellationToken);

        public async Task<bool> ReplaceAsync(string key, SessionSnapshot expectedSnapshot, AuthenticationTicket replacementTicket, CancellationToken cancellationToken)
        {
            if (_hookPending)
            {
                _hookPending = false;
                await _beforeReplace();
            }
            cancellationToken.ThrowIfCancellationRequested();
            return await _inner.ReplaceAsync(key, expectedSnapshot, replacementTicket, cancellationToken);
        }
    }
}
