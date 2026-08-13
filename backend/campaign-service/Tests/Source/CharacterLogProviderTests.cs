using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Models.Providing;

namespace Tdn.Tests.Source;

public class CharacterLogProviderTests
{
    [Fact]
    public void PushEntry_CreatesNewDocument_OnFirstEntry()
    {
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var collectionMock = new Mock<IMongoCollection<CharacterLogDocument>>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetCollection<CharacterLogDocument>(MongoCollections.CharacterLogs))
            .Returns(collectionMock.Object);
        
        var provider = new CharacterLogProvider(mongoMock.Object);
        var entry = new CharacterLogEntry 
        { 
            Timestamp = DateTime.UtcNow, 
            ActorId = 1, 
            ActionType = "test",
            Details = new BsonDocument { ["key"] = "hp", ["oldValue"] = 10, ["delta"] = -5 }
        };
        
        provider.PushEntry(100, 10, entry);
        
        collectionMock.Verify(m => m.UpdateOne(
            It.IsAny<FilterDefinition<CharacterLogDocument>>(),
            It.IsAny<UpdateDefinition<CharacterLogDocument>>(),
            It.Is<UpdateOptions>(o => o.IsUpsert == true),
            It.IsAny<CancellationToken>()), 
            Times.Once);
    }

    [Fact]
    public void Log_CreatesEntryWithFreeFormDetails_ForArbitraryActionType()
    {
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var collectionMock = new Mock<IMongoCollection<CharacterLogDocument>>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetCollection<CharacterLogDocument>(MongoCollections.CharacterLogs))
            .Returns(collectionMock.Object);

        var provider = new CharacterLogProvider(mongoMock.Object);
        provider.Log(100, 10, 42, "SomeCustomAction", new Dictionary<string, object?>
        {
            ["note"] = "text value",
            ["oldValue"] = 7,
            ["delta"] = 3
        });

        collectionMock.Verify(m => m.UpdateOne(
            It.IsAny<FilterDefinition<CharacterLogDocument>>(),
            It.IsAny<UpdateDefinition<CharacterLogDocument>>(),
            It.Is<UpdateOptions>(o => o.IsUpsert == true),
            It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public void Log_SkipsEntry_WhenActorIdIsNegativeOne()
    {
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var collectionMock = new Mock<IMongoCollection<CharacterLogDocument>>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetCollection<CharacterLogDocument>(MongoCollections.CharacterLogs))
            .Returns(collectionMock.Object);

        var provider = new CharacterLogProvider(mongoMock.Object);
        provider.Log(100, 10, -1, "UpdateField", new Dictionary<string, object?>());

        collectionMock.Verify(m => m.UpdateOne(
            It.IsAny<FilterDefinition<CharacterLogDocument>>(),
            It.IsAny<UpdateDefinition<CharacterLogDocument>>(),
            It.IsAny<UpdateOptions>(),
            It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
