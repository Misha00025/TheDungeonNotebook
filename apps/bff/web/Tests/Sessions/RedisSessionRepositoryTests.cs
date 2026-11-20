using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Moq;
using StackExchange.Redis;
using Tdn.Bff.Configuration;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Sessions;

public sealed class RedisSessionRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2030, 2, 3, 4, 5, 6, TimeSpan.Zero);
    private static readonly DateTimeOffset SessionExpiry = Now.AddDays(31);

    [Fact]
    public async Task CreateStoresProtectedPayloadAndRemainingTtl()
    {
        var (repository, database) = CreateRepository();
        byte[]? storedPayload = null;
        TimeSpan? storedTtl = null;
        var ticket = CreateTicket(SessionExpiry, "synthetic-access-secret", "synthetic-refresh-secret");
        database.Setup(db => db.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan?>(), It.IsAny<When>()))
            .Callback<RedisKey, RedisValue, TimeSpan?, When>((_, value, ttl, _) =>
            {
                storedPayload = (byte[])value!;
                storedTtl = ttl;
            })
            .ReturnsAsync(true);

        await repository.CreateAsync("session-key", ticket, CancellationToken.None);

        Assert.NotNull(storedPayload);
        var serializedPayload = Encoding.UTF8.GetString(storedPayload);
        Assert.DoesNotContain("synthetic-access-secret", serializedPayload);
        Assert.DoesNotContain("synthetic-refresh-secret", serializedPayload);
        Assert.NotNull(storedTtl);
        Assert.Equal(TimeSpan.FromDays(31), storedTtl.Value);
        database.Verify(db => db.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan?>(), When.NotExists), Times.Once);
    }

    [Fact]
    public async Task GetRoundTripsTicketAndReturnsNullForCorruptOrExpiredPayload()
    {
        var (repository, database, provider, timeProvider) = CreateRepositoryWithProvider();
        RedisValue wire = RedisValue.Null;
        database.Setup(db => db.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan?>(), It.IsAny<When>()))
            .Callback<RedisKey, RedisValue, TimeSpan?, When>((_, value, _, _) => wire = value)
            .ReturnsAsync(true);
        database.Setup(db => db.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>())).Returns(() => Task.FromResult(wire));
        var ticket = CreateTicket(SessionExpiry, "synthetic-access", "synthetic-refresh");

        await repository.CreateAsync("session", ticket, CancellationToken.None);
        var restored = await repository.GetAsync("session", CancellationToken.None);
        Assert.Equal("synthetic-access", restored?.Ticket.Properties.GetTokenValue("access_token"));
        Assert.Equal("synthetic-refresh", restored?.Ticket.Properties.GetTokenValue("refresh_token"));
        Assert.Equal((byte[])wire!, restored?.ProtectedPayload);

        wire = Encoding.UTF8.GetBytes("not-a-protected-ticket");
        Assert.Null(await repository.GetAsync("session", CancellationToken.None));

        var protector = provider.CreateProtector("Tdn.Bff.SessionTicket");
        wire = protector.Protect(TicketSerializer.Default.Serialize(CreateTicket(timeProvider.GetUtcNow().AddSeconds(-1), "expired", "expired-refresh")));
        Assert.Null(await repository.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task GetDoesNotMaskRedisExceptions()
    {
        var (repository, database) = CreateRepository();
        database.Setup(db => db.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "synthetic"));

        await Assert.ThrowsAsync<RedisConnectionException>(() => repository.GetAsync("session", CancellationToken.None));
    }

    [Fact]
    public async Task CompareAndSetPassesOriginalProtectedPayloadAndScriptToDatabase()
    {
        var (repository, database) = CreateRepository();
        RedisKey[]? scriptKeys = null;
        RedisValue[]? scriptValues = null;
        string? script = null;
        database.Setup(db => db.ScriptEvaluateAsync(It.IsAny<string>(), It.IsAny<RedisKey[]?>(), It.IsAny<RedisValue[]?>(), It.IsAny<CommandFlags>()))
            .Callback<string, RedisKey[]?, RedisValue[]?, CommandFlags>((source, keys, values, _) =>
            {
                script = source;
                scriptKeys = keys;
                scriptValues = values;
            })
            .ReturnsAsync(RedisResult.Create(0));
        var originalWire = Encoding.UTF8.GetBytes("original-wire");
        var expected = new SessionSnapshot(CreateTicket(SessionExpiry, "old", "refresh"), originalWire);

        var replaced = await repository.ReplaceAsync("session", expected, CreateTicket(SessionExpiry, "replacement", "refresh"), CancellationToken.None);

        Assert.False(replaced);
        Assert.NotNull(script);
        Assert.Contains("value == ARGV[1]", script);
        Assert.Contains("redis.call('SET'", script);
        Assert.Equal(originalWire, (byte[])scriptValues![0]!);
        Assert.Equal("tdn:bff:session", (string?)scriptKeys![0]);
        Assert.DoesNotContain("replacement", Encoding.UTF8.GetString((byte[])scriptValues[1]!));
    }

    [Fact]
    public async Task CompareDeletePassesExpectedWireAndScriptToDatabase()
    {
        var (repository, database) = CreateRepository();
        RedisValue[]? scriptValues = null;
        string? script = null;
        database.Setup(db => db.ScriptEvaluateAsync(It.IsAny<string>(), It.IsAny<RedisKey[]?>(), It.IsAny<RedisValue[]?>(), It.IsAny<CommandFlags>()))
            .Callback<string, RedisKey[]?, RedisValue[]?, CommandFlags>((source, _, values, _) =>
            {
                script = source;
                scriptValues = values;
            })
            .ReturnsAsync(RedisResult.Create(1));
        var wire = Encoding.UTF8.GetBytes("expected-protected-wire");

        Assert.True(await repository.DeleteIfUnchangedAsync("session", new SessionSnapshot(CreateTicket(SessionExpiry, "a", "r"), wire), CancellationToken.None));

        Assert.Contains("value == ARGV[1]", script);
        Assert.Contains("redis.call('DEL'", script);
        Assert.DoesNotContain("redis.call('SET'", script);
        Assert.Equal(wire, (byte[])scriptValues![0]!);
    }

    [Fact]
    public async Task ReplaceUsesInjectedClockForAtomicRenewedTtl()
    {
        var (repository, database, _, timeProvider) = CreateRepositoryWithProvider();
        RedisValue[]? scriptValues = null;
        database.Setup(db => db.ScriptEvaluateAsync(It.IsAny<string>(), It.IsAny<RedisKey[]?>(), It.IsAny<RedisValue[]?>(), It.IsAny<CommandFlags>()))
            .Callback<string, RedisKey[]?, RedisValue[]?, CommandFlags>((_, _, values, _) => scriptValues = values)
            .ReturnsAsync(RedisResult.Create(1));
        var expected = new SessionSnapshot(CreateTicket(SessionExpiry, "old", "refresh"), Encoding.UTF8.GetBytes("expected"));
        var renewedExpiry = timeProvider.GetUtcNow().AddDays(31);

        var replaced = await repository.ReplaceAsync("session", expected, CreateTicket(renewedExpiry, "new", "refresh"), CancellationToken.None);

        Assert.True(replaced);
        Assert.Equal((long)TimeSpan.FromDays(31).TotalMilliseconds, (long)scriptValues![2]!);
    }

    [Fact]
    public async Task GetRejectsPayloadWhoseTicketExpiryHasPassedAccordingToInjectedClock()
    {
        var (repository, database, provider, timeProvider) = CreateRepositoryWithProvider();
        var protector = provider.CreateProtector("Tdn.Bff.SessionTicket");
        var wire = protector.Protect(TicketSerializer.Default.Serialize(CreateTicket(timeProvider.GetUtcNow().AddTicks(-1), "expired", "refresh")));
        database.Setup(db => db.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>())).ReturnsAsync((RedisValue)wire);

        Assert.Null(await repository.GetAsync("session", CancellationToken.None));
    }

    private static (RedisSessionRepository Repository, Mock<IDatabase> Database) CreateRepository()
    {
        var (repository, database, _, _) = CreateRepositoryWithProvider();
        return (repository, database);
    }

    private static (RedisSessionRepository Repository, Mock<IDatabase> Database, IDataProtectionProvider Provider, FixedTimeProvider TimeProvider) CreateRepositoryWithProvider()
    {
        var database = new Mock<IDatabase>();
        var connection = new Mock<IConnectionMultiplexer>();
        connection.Setup(client => client.GetDatabase(It.IsAny<int>(), It.IsAny<object?>())).Returns(database.Object);
        var provider = new EphemeralDataProtectionProvider();
        var timeProvider = new FixedTimeProvider(Now);
        var repository = new RedisSessionRepository(connection.Object, provider, Options.Create(new BffOptions
        {
            Redis = new RedisOptions { ConnectionString = "unused", KeyPrefix = "tdn:bff:" }
        }), timeProvider);
        return (repository, database, provider, timeProvider);
    }

    private static AuthenticationTicket CreateTicket(DateTimeOffset expiry, string accessToken, string refreshToken)
    {
        var principal = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity("test"));
        var properties = new AuthenticationProperties { ExpiresUtc = expiry };
        properties.StoreTokens(
        [
            new AuthenticationToken { Name = "access_token", Value = accessToken },
            new AuthenticationToken { Name = "refresh_token", Value = refreshToken }
        ]);
        return new AuthenticationTicket(principal, properties, "test");
    }
}
