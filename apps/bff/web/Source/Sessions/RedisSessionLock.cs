using Medallion.Threading.Redis;
using Medallion.Threading;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Tdn.Bff.Configuration;

namespace Tdn.Bff.Sessions;

public sealed class RedisSessionLock : ISessionLock
{
    private readonly IDatabase _database;
    private readonly BffOptions _options;

    public RedisSessionLock(IConnectionMultiplexer connection, IOptions<BffOptions> options)
    {
        _database = connection.GetDatabase();
        _options = options.Value;
    }

    public async Task<ISessionLockLease> AcquireAsync(string key, CancellationToken cancellationToken)
    {
        var distributedLock = new RedisDistributedLock(
            $"{_options.Redis.KeyPrefix}session-lock:{key}",
            _database,
            lockOptions =>
            {
                lockOptions.Expiry(_options.Session.LockExpiry);
                lockOptions.ExtensionCadence(_options.Session.LockExtensionCadence);
            });
        var handle = await distributedLock.AcquireAsync(_options.Session.LockWaitTimeout, cancellationToken).ConfigureAwait(false);
        return new SessionLockLease(handle);
    }

    private sealed class SessionLockLease : ISessionLockLease
    {
        private readonly IDistributedSynchronizationHandle _handle;

        public SessionLockLease(IDistributedSynchronizationHandle handle)
        {
            _handle = handle;
        }

        public CancellationToken HandleLostToken => _handle.HandleLostToken;

        public ValueTask DisposeAsync() => _handle.DisposeAsync();
    }
}
