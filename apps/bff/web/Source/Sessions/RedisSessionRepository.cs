using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Tdn.Bff.Configuration;

namespace Tdn.Bff.Sessions;

public sealed class RedisSessionRepository : ISessionRepository
{
    private const string ReplaceScript = "local value = redis.call('GET', KEYS[1]); if value and value == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3]); return 1 else return 0 end";
    private const string DeleteIfUnchangedScript = "local value = redis.call('GET', KEYS[1]); if value and value == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
    private readonly IDatabase _database;
    private readonly IDataProtector _protector;
    private readonly string _keyPrefix;
    private readonly TimeProvider _timeProvider;

    public RedisSessionRepository(IConnectionMultiplexer connection, IDataProtectionProvider dataProtectionProvider, IOptions<BffOptions> options, TimeProvider timeProvider)
    {
        _database = connection.GetDatabase();
        _protector = dataProtectionProvider.CreateProtector("Tdn.Bff.SessionTicket");
        _keyPrefix = options.Value.Redis.KeyPrefix;
        _timeProvider = timeProvider;
    }

    public async Task<SessionSnapshot?> GetAsync(string key, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var protectedPayload = await _database.StringGetAsync(ToRedisKey(key)).ConfigureAwait(false);
        if (protectedPayload.IsNull)
            return null;

        try
        {
            var bytes = (byte[])protectedPayload!;
            var ticket = TicketSerializer.Default.Deserialize(_protector.Unprotect(bytes));
            if (ticket?.Properties.ExpiresUtc is not { } expiresUtc || expiresUtc <= _timeProvider.GetUtcNow())
                return null;
            return new SessionSnapshot(ticket, bytes);
        }
        catch (CryptographicException)
        {
            return null;
        }
        catch (FormatException)
        {
            return null;
        }
        catch (Exception exception) when (exception is InvalidDataException or EndOfStreamException or ArgumentException)
        {
            return null;
        }
    }

    public async Task CreateAsync(string key, AuthenticationTicket ticket, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var expiry = GetExpiry(ticket);
        var remaining = expiry - _timeProvider.GetUtcNow();
        if (remaining <= TimeSpan.Zero)
            throw new ArgumentException("An unexpired ticket is required.", nameof(ticket));

        var payload = Protect(ticket);
        await _database.StringSetAsync(ToRedisKey(key), payload, remaining, When.NotExists).ConfigureAwait(false);
    }

    public async Task<bool> ReplaceAsync(string key, SessionSnapshot expectedSnapshot, AuthenticationTicket replacementTicket, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var expiry = GetExpiry(replacementTicket);
        var remaining = expiry - _timeProvider.GetUtcNow();
        if (remaining <= TimeSpan.Zero)
            return false;

        var replacementPayload = Protect(replacementTicket);
        var result = await _database.ScriptEvaluateAsync(
            ReplaceScript,
            [ToRedisKey(key)],
            [expectedSnapshot.ProtectedPayload, replacementPayload, (long)Math.Ceiling(remaining.TotalMilliseconds)]).ConfigureAwait(false);
        return (long)result == 1;
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await _database.KeyDeleteAsync(ToRedisKey(key)).ConfigureAwait(false);
    }

    public async Task<bool> DeleteIfUnchangedAsync(string key, SessionSnapshot expectedSnapshot, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var result = await _database.ScriptEvaluateAsync(
            DeleteIfUnchangedScript,
            [ToRedisKey(key)],
            [expectedSnapshot.ProtectedPayload]).ConfigureAwait(false);
        return (long)result == 1;
    }

    private RedisKey ToRedisKey(string key) => $"{_keyPrefix}{key}";

    private byte[] Protect(AuthenticationTicket ticket)
    {
        var serialized = TicketSerializer.Default.Serialize(ticket);
        return _protector.Protect(serialized);
    }

    private static DateTimeOffset GetExpiry(AuthenticationTicket ticket) =>
        ticket.Properties.ExpiresUtc ?? throw new ArgumentException("Ticket expiration is required.", nameof(ticket));
}
