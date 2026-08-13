using MongoDB.Bson;
using MongoDB.Driver;
using Microsoft.Extensions.Logging;
using Tdn.Models;
using Tdn.Models.DTOs;
using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class CharactersProviderTests
{
    [Fact]
    public void PatchCharacter_NonExistentCharacter_Returns404()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var loggerMock = new Mock<ILogger<CharactersProvider>>();
        var provider = new CharactersProvider(ctx, mongoMock.Object, loggerMock.Object);

        var result = provider.PatchCharacter(1, 999, new CharacterPatchData { Name = "NewName" });

        Assert.False(result.Success);
        Assert.Equal(404, result.StatusCode);
    }

    [Fact]
    public void PatchCharacter_UpdateNameAndDescription()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData
            {
                Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString(),
            });
            db.Set<CharacterData>().Add(new CharacterData
            {
                Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100
            });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData { Name = "OldName", Description = "OldDesc", Fields = new() });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        var replaceResult = new ReplaceOneResult.Acknowledged(1L, 1L, null);
        collectionMock
            .Setup(c => c.ReplaceOne(
                It.IsAny<FilterDefinition<CharacterMongoData>>(),
                It.IsAny<CharacterMongoData>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(replaceResult);
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>("characters"))
            .Returns(collectionMock.Object);

        var loggerMock = new Mock<ILogger<CharactersProvider>>();
        var provider = new CharactersProvider(ctx, mongoMock.Object, loggerMock.Object);

        var result = provider.PatchCharacter(1, 1, new CharacterPatchData { Name = "NewName", Description = "NewDesc" });

        Assert.True(result.Success);
        Assert.NotNull(result.Data);
        Assert.Equal("NewName", result.Data!["name"]);
        Assert.Equal("NewDesc", result.Data!["description"]);
    }

    [Fact]
    public void PatchCharacter_EmptyPatch_Returns400()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData
            {
                Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString(),
            });
            db.Set<CharacterData>().Add(new CharacterData
            {
                Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100
            });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData { Name = "OldName", Description = "OldDesc", Fields = new() });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var loggerMock = new Mock<ILogger<CharactersProvider>>();
        var provider = new CharactersProvider(ctx, mongoMock.Object, loggerMock.Object);

        var result = provider.PatchCharacter(1, 1, new CharacterPatchData());

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
    }
}
