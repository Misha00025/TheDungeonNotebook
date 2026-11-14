using Microsoft.AspNetCore.Authentication;
using Tdn.Bff.Sessions;
using bff_web.Tests.Support;

namespace bff_web.Tests.Sessions;

public sealed class RedisTicketStoreTests
{
    private static readonly DateTimeOffset Now = new(2030, 2, 3, 4, 5, 6, TimeSpan.Zero);

    [Fact]
    public async Task StoreCreatesDistinctOpaqueKeysAndAddsServerSessionClaim()
    {
        var repository = new FakeSessionRepository(new FixedTimeProvider(Now));
        var store = new RedisTicketStore(repository);
        var source = TicketFactory.Create(Now.AddHours(8), Now.AddMinutes(2));

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
    public async Task RemoveDeletesRecordAndRenewIsNoOpForChangedOrDeletedSession()
    {
        var repository = new FakeSessionRepository(new FixedTimeProvider(Now));
        var store = new RedisTicketStore(repository);
        var staleTicket = TicketFactory.Create(Now.AddHours(8), Now.AddSeconds(5));
        var key = await store.StoreAsync(staleTicket);
        var snapshot = await repository.GetAsync(key, CancellationToken.None);
        Assert.NotNull(snapshot);
        var updatedTicket = new AuthenticationTicket(snapshot.Ticket.Principal, snapshot.Ticket.Properties.Clone(), snapshot.Ticket.AuthenticationScheme);
        updatedTicket.Properties.UpdateTokenValue("access_token", "access-new");
        Assert.True(await repository.ReplaceAsync(key, snapshot, updatedTicket, CancellationToken.None));

        await store.RenewAsync(key, staleTicket);

        Assert.Equal("access-new", (await store.RetrieveAsync(key))?.Properties.GetTokenValue("access_token"));
        await store.RemoveAsync(key);
        await store.RenewAsync(key, staleTicket);
        Assert.Null(await store.RetrieveAsync(key));
    }
}
