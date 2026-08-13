using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class CharacterEquipmentProviderTests
{
    [Fact]
    public void GetEquipment_ReturnsEquipmentList()
    {
        var charUuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Characters.Add(new CharacterData { Id = 100, GroupId = 1, UUID = charUuid, TemplateId = 1 });
            db.Templates.Add(new TemplateData { Id = 1, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>(MongoCollections.Characters, charUuid))
            .Returns(new CharacterMongoData { Equipment = new List<int> { 10, 20 } });

        var provider = new CharacterEquipmentProvider(ctx, mongoMock.Object);
        
        var equipment = provider.GetEquipment(1, 100);
        
        Assert.Equal(2, equipment.Count);
        Assert.Contains(10, equipment);
        Assert.Contains(20, equipment);
    }

    [Fact]
    public void TryAddEquipment_CallsUpdateOne()
    {
        var charUuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Characters.Add(new CharacterData { Id = 100, GroupId = 1, UUID = charUuid, TemplateId = 1 });
            db.Templates.Add(new TemplateData { Id = 1, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
        });
        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>(MongoCollections.Characters))
            .Returns(collectionMock.Object);
        var updateResult = new Mock<UpdateResult>();
        updateResult.Setup(r => r.ModifiedCount).Returns(1);
        updateResult.Setup(r => r.IsAcknowledged).Returns(true);
        collectionMock
            .Setup(m => m.UpdateOne(
                It.IsAny<FilterDefinition<CharacterMongoData>>(),
                It.IsAny<UpdateDefinition<CharacterMongoData>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(updateResult.Object);

        var provider = new CharacterEquipmentProvider(ctx, mongoMock.Object);

        var result = provider.TryAddEquipment(1, 100, 30);
        
        Assert.True(result);
    }

    [Fact]
    public void TryRemoveEquipment_CallsUpdateOne()
    {
        var charUuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Characters.Add(new CharacterData { Id = 100, GroupId = 1, UUID = charUuid, TemplateId = 1 });
            db.Templates.Add(new TemplateData { Id = 1, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
        });
        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>(MongoCollections.Characters))
            .Returns(collectionMock.Object);
        var updateResult = new Mock<UpdateResult>();
        updateResult.Setup(r => r.ModifiedCount).Returns(1);
        updateResult.Setup(r => r.IsAcknowledged).Returns(true);
        collectionMock
            .Setup(m => m.UpdateOne(
                It.IsAny<FilterDefinition<CharacterMongoData>>(),
                It.IsAny<UpdateDefinition<CharacterMongoData>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(updateResult.Object);

        var provider = new CharacterEquipmentProvider(ctx, mongoMock.Object);

        var result = provider.TryRemoveEquipment(1, 100, 30);
        
        Assert.True(result);
    }

    [Fact]
    public void TrySaveEquipment_CallsUpdateOne()
    {
        var charUuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Characters.Add(new CharacterData { Id = 100, GroupId = 1, UUID = charUuid, TemplateId = 1 });
            db.Templates.Add(new TemplateData { Id = 1, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
        });
        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>(MongoCollections.Characters))
            .Returns(collectionMock.Object);
        var updateResult = new Mock<UpdateResult>();
        updateResult.Setup(r => r.ModifiedCount).Returns(1);
        updateResult.Setup(r => r.IsAcknowledged).Returns(true);
        collectionMock
            .Setup(m => m.UpdateOne(
                It.IsAny<FilterDefinition<CharacterMongoData>>(),
                It.IsAny<UpdateDefinition<CharacterMongoData>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(updateResult.Object);

        var provider = new CharacterEquipmentProvider(ctx, mongoMock.Object);

        var result = provider.TrySaveEquipment(1, 100, new List<int> { 10, 20, 30 });
        
        Assert.True(result);
    }
}
