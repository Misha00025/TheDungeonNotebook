using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Moq;
using StackExchange.Redis;
using Tdn.Bff.Configuration;
using Tdn.Bff.Oidc;

namespace bff_web.Tests.Oidc;

public sealed class RedisLogoutRedirectStoreTests
{
    [Fact]
    public async Task StoreEncryptsValueAndSetsConfiguredLifetime()
    {
        var database = new Mock<IDatabase>(MockBehavior.Strict);
        RedisKey storedKey = default;
        RedisValue storedValue = default;
        TimeSpan? expiry = null;
        database.Setup(value => value.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan?>(), When.NotExists))
            .Callback<RedisKey, RedisValue, TimeSpan?, When>((key, value, duration, _) =>
            {
                storedKey = key;
                storedValue = value;
                expiry = duration;
            })
            .ReturnsAsync(true);
        var (store, connection) = CreateStore(database.Object, TimeSpan.FromMinutes(7));

        var request = await store.StoreAsync("https://idp.example/logout?id_token_hint=secret", CancellationToken.None);

        Assert.StartsWith("logout:", storedKey.ToString().Replace("test:bff:", "", StringComparison.Ordinal));
        Assert.Equal(TimeSpan.FromMinutes(7), expiry);
        Assert.DoesNotContain("secret", storedValue.ToString());
        connection.Verify(value => value.GetDatabase(It.IsAny<int>(), It.IsAny<object?>()), Times.Once);
        Assert.False(string.IsNullOrWhiteSpace(request));
    }

    [Fact]
    public async Task TakeUsesAtomicGetDeleteAndReturnsDecryptedValueOnce()
    {
        var database = new Mock<IDatabase>(MockBehavior.Strict);
        var dataProtectionProvider = new EphemeralDataProtectionProvider();
        var protector = dataProtectionProvider.CreateProtector("Tdn.Bff.LogoutRedirect");
        var protectedBytes = protector.Protect(Encoding.UTF8.GetBytes("https://idp.example/logout"));
        database.SetupSequence(value => value.StringGetDeleteAsync(It.IsAny<RedisKey>(), CommandFlags.None))
            .ReturnsAsync((RedisValue)protectedBytes)
            .ReturnsAsync(RedisValue.Null);
        var (store, _) = CreateStore(database.Object, TimeSpan.FromMinutes(5), dataProtectionProvider);

        var result = await store.TakeAsync("opaque", CancellationToken.None);
        var secondResult = await store.TakeAsync("opaque", CancellationToken.None);

        Assert.Equal("https://idp.example/logout", result);
        Assert.Null(secondResult);
        database.Verify(value => value.StringGetDeleteAsync("test:bff:logout:opaque", CommandFlags.None), Times.Exactly(2));
    }

    [Fact]
    public async Task TakeReturnsNullForMissingExpiredOrCorruptValue()
    {
        var database = new Mock<IDatabase>(MockBehavior.Strict);
        database.SetupSequence(value => value.StringGetDeleteAsync(It.IsAny<RedisKey>(), CommandFlags.None))
            .ReturnsAsync(RedisValue.Null)
            .ReturnsAsync(RedisValue.Null)
            .ReturnsAsync((RedisValue)"corrupt");
        var (store, _) = CreateStore(database.Object, TimeSpan.FromMinutes(5));

        Assert.Null(await store.TakeAsync("missing", CancellationToken.None));
        Assert.Null(await store.TakeAsync("expired", CancellationToken.None));
        Assert.Null(await store.TakeAsync("corrupt", CancellationToken.None));
    }

    private static (RedisLogoutRedirectStore Store, Mock<IConnectionMultiplexer> Connection) CreateStore(IDatabase database, TimeSpan lifetime, IDataProtectionProvider? dataProtectionProvider = null)
    {
        var connection = new Mock<IConnectionMultiplexer>();
        connection.Setup(value => value.GetDatabase(It.IsAny<int>(), It.IsAny<object?>())).Returns(database);
        var options = new BffOptions
        {
            Redis = new RedisOptions { KeyPrefix = "test:bff:" },
            Logout = new LogoutOptions { RequestLifetime = lifetime }
        };
        var store = new RedisLogoutRedirectStore(connection.Object, dataProtectionProvider ?? new EphemeralDataProtectionProvider(), Options.Create(options));
        return (store, connection);
    }
}
