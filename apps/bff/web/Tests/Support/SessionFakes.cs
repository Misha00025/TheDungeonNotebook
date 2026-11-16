using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Options;
using Tdn.Bff.Configuration;
using Tdn.Bff.Oidc;
using Tdn.Bff.Sessions;

namespace bff_web.Tests.Support;

internal sealed class FixedTimeProvider : TimeProvider
{
    public FixedTimeProvider(DateTimeOffset now)
    {
        Now = now;
    }

    public DateTimeOffset Now { get; set; }

    public override DateTimeOffset GetUtcNow() => Now;
}

internal sealed class FakeSessionRepository : ISessionRepository
{
    private readonly object _gate = new();
    private readonly Dictionary<string, SessionSnapshot> _records = new(StringComparer.Ordinal);
    private readonly TimeProvider _timeProvider;
    private long _version;

    public FakeSessionRepository(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
    }

    public Task<SessionSnapshot?> GetAsync(string key, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_gate)
        {
            if (!_records.TryGetValue(key, out var snapshot) || snapshot.Ticket.Properties.ExpiresUtc is not { } expiresAt || expiresAt <= _timeProvider.GetUtcNow())
                return Task.FromResult<SessionSnapshot?>(null);
            return Task.FromResult<SessionSnapshot?>(CopySnapshot(snapshot));
        }
    }

    public Task CreateAsync(string key, AuthenticationTicket ticket, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_gate)
            _records[key] = NewSnapshot(ticket);
        return Task.CompletedTask;
    }

    public Task<bool> ReplaceAsync(string key, SessionSnapshot expectedSnapshot, AuthenticationTicket replacementTicket, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_gate)
        {
            if (!_records.TryGetValue(key, out var current) || !current.ProtectedPayload.SequenceEqual(expectedSnapshot.ProtectedPayload))
                return Task.FromResult(false);
            if (replacementTicket.Properties.ExpiresUtc is not { } expiresAt || expiresAt <= _timeProvider.GetUtcNow())
                return Task.FromResult(false);
            _records[key] = NewSnapshot(replacementTicket);
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteIfUnchangedAsync(string key, SessionSnapshot expectedSnapshot, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_gate)
        {
            if (!_records.TryGetValue(key, out var current) || !current.ProtectedPayload.SequenceEqual(expectedSnapshot.ProtectedPayload))
                return Task.FromResult(false);
            _records.Remove(key);
            return Task.FromResult(true);
        }
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_gate)
            _records.Remove(key);
        return Task.CompletedTask;
    }

    public void SetTicket(string key, AuthenticationTicket ticket)
    {
        lock (_gate)
            _records[key] = NewSnapshot(ticket);
    }

    private SessionSnapshot NewSnapshot(AuthenticationTicket ticket) =>
        new(ticket, BitConverter.GetBytes(Interlocked.Increment(ref _version)));

    private static SessionSnapshot CopySnapshot(SessionSnapshot snapshot) =>
        new(snapshot.Ticket, snapshot.ProtectedPayload.ToArray());
}

internal sealed class FakeSessionLock : ISessionLock
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _semaphores = new(StringComparer.Ordinal);
    private FakeSessionLockLease? _lastLease;
    private int _acquireCount;

    public bool ThrowTimeout { get; set; }
    public TimeSpan Timeout { get; set; } = System.Threading.Timeout.InfiniteTimeSpan;
    public TaskCompletionSource<bool> SecondAcquireAttempted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public int AcquireCount => Volatile.Read(ref _acquireCount);

    public async Task<ISessionLockLease> AcquireAsync(string key, CancellationToken cancellationToken)
    {
        var count = Interlocked.Increment(ref _acquireCount);
        if (count >= 2)
            SecondAcquireAttempted.TrySetResult(true);
        if (ThrowTimeout)
            throw new TimeoutException();
        var semaphore = _semaphores.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        if (!await semaphore.WaitAsync(Timeout, cancellationToken).ConfigureAwait(false))
            throw new TimeoutException();
        var lease = new FakeSessionLockLease(semaphore);
        Volatile.Write(ref _lastLease, lease);
        return lease;
    }

    public void LoseLatestLease() => Volatile.Read(ref _lastLease)?.Lose();

    private sealed class FakeSessionLockLease : ISessionLockLease
    {
        private readonly SemaphoreSlim _semaphore;
        private readonly CancellationTokenSource _lost = new();
        private int _disposed;

        public FakeSessionLockLease(SemaphoreSlim semaphore)
        {
            _semaphore = semaphore;
        }

        public CancellationToken HandleLostToken => _lost.Token;

        public void Lose() => _lost.Cancel();

        public ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposed, 1) == 0)
                _semaphore.Release();
            _lost.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}

internal sealed class FakeOidcTokenClient : IOidcTokenClient
{
    private int _refreshCount;
    private int _redeemCount;

    public Func<CancellationToken, Task<OidcTokenResponse>> RefreshHandler { get; set; } =
        _ => Task.FromResult(new OidcTokenResponse(true, false, null, "new-access", null, 300, null));

    public int RefreshCount => Volatile.Read(ref _refreshCount);
    public int RedeemCount => Volatile.Read(ref _redeemCount);

    public Task<OidcTokenResponse> RedeemCodeAsync(OpenIdConnectOptions options, string code, string redirectUri, string codeVerifier, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref _redeemCount);
        return Task.FromResult(new OidcTokenResponse(false, false, null, null, null, null, null));
    }

    public Task<OidcTokenResponse> RefreshAsync(OpenIdConnectOptions options, string refreshToken, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref _refreshCount);
        return RefreshHandler(cancellationToken);
    }
}

internal sealed class FixedOptionsMonitor<T> : IOptionsMonitor<T> where T : class
{
    private readonly T _value;

    public FixedOptionsMonitor(T value)
    {
        _value = value;
    }

    public T CurrentValue => _value;

    public T Get(string? name) => _value;

    public IDisposable? OnChange(Action<T, string?> listener) => null;
}

internal static class TicketFactory
{
    public static AuthenticationTicket Create(
        DateTimeOffset sessionExpiresAt,
        DateTimeOffset accessExpiresAt,
        string accessToken = "access-old",
        string? refreshToken = "refresh-old",
        string subject = "subject-a")
    {
        var identity = new System.Security.Claims.ClaimsIdentity("test");
        identity.AddClaim(new System.Security.Claims.Claim("sub", subject));
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);
        var properties = new AuthenticationProperties { ExpiresUtc = sessionExpiresAt };
        var tokens = new List<AuthenticationToken>
        {
            new() { Name = "access_token", Value = accessToken },
            new() { Name = "expires_at", Value = accessExpiresAt.ToString("O") }
        };
        if (refreshToken is not null)
            tokens.Add(new AuthenticationToken { Name = "refresh_token", Value = refreshToken });
        properties.StoreTokens(tokens);
        return new AuthenticationTicket(principal, properties, BffAuthenticationDefaults.Cookies);
    }
}

internal static class TestOptions
{
    public static BffOptions Bff(TimeSpan? threshold = null) => new()
    {
        Session = new SessionOptions
        {
            RefreshBeforeExpiry = threshold ?? TimeSpan.FromSeconds(30),
            AccessTokenLifetimeWhenMissing = TimeSpan.FromMinutes(5)
        }
    };

    public static SessionTokenService TokenService(FakeSessionRepository repository, FakeSessionLock sessionLock, FakeOidcTokenClient client, FixedTimeProvider timeProvider, BffOptions? bffOptions = null) =>
        new(repository, sessionLock, client, new FixedOptionsMonitor<OpenIdConnectOptions>(new OpenIdConnectOptions()), Options.Create(bffOptions ?? Bff()), timeProvider);
}

internal sealed class FakeLogoutRedirectStore : ILogoutRedirectStore
{
    private readonly Dictionary<string, string> _values = new(StringComparer.Ordinal);

    public Task<string> StoreAsync(string redirectUrl, CancellationToken cancellationToken)
    {
        var request = Guid.NewGuid().ToString("N");
        _values[request] = redirectUrl;
        return Task.FromResult(request);
    }

    public Task<string?> TakeAsync(string request, CancellationToken cancellationToken)
    {
        if (!_values.Remove(request, out var value))
            return Task.FromResult<string?>(null);
        return Task.FromResult<string?>(value);
    }
}
