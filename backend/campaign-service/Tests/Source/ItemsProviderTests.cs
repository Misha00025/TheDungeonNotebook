using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Models;
using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class ItemsProviderTests
{
    [Fact]
    public void GetItems_ReturnsAllGroupItems()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Items.Add(new ItemData { Id = 10, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Items.Add(new ItemData { Id = 20, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<ItemMongoData>("items", It.IsAny<string>()))
            .Returns(new ItemMongoData { Name = "Item", Description = "Desc" });
        var attrsMock = new Mock<AttributesProvider>(MockBehavior.Loose, mongoMock.Object);
        var loggerMock = new Mock<ILogger<ItemsProvider>>();
        
        var provider = new ItemsProvider(ctx, mongoMock.Object, attrsMock.Object, loggerMock.Object);
        
        var items = provider.GetItems(1);
        
        Assert.Equal(2, items.Count());
    }

    [Fact]
    public void GetItem_WhenExists_ReturnsItem()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Items.Add(new ItemData { Id = 10, GroupId = 1, UUID = uuid });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<ItemMongoData>("items", uuid))
            .Returns(new ItemMongoData { Name = "Sword", Description = "A sharp blade", Price = 100 });
        var attrsMock = new Mock<AttributesProvider>(MockBehavior.Loose, mongoMock.Object);
        var loggerMock = new Mock<ILogger<ItemsProvider>>();
        
        var provider = new ItemsProvider(ctx, mongoMock.Object, attrsMock.Object, loggerMock.Object);
        
        var item = provider.GetItem(1, 10);
        
        Assert.NotNull(item);
        Assert.Equal("Sword", item.Name);
    }
}
