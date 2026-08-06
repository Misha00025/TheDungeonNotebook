using MongoDB.Bson;
using MongoDB.Driver;
using Microsoft.Extensions.Logging;
using Tdn.Models;
using Tdn.Models.DTOs;
using Tdn.Models.Commands;
using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class CommandsProviderTests
{
    [Fact]
    public void AddField_CreatesNewField()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData { Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Set<CharacterData>().Add(new CharacterData { Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100 });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData { Name = "TestChar", Description = "", Fields = new() });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        collectionMock.Setup(c => c.ReplaceOne(
            It.IsAny<FilterDefinition<CharacterMongoData>>(),
            It.IsAny<CharacterMongoData>(),
            It.IsAny<ReplaceOptions>(),
            It.IsAny<CancellationToken>()))
            .Returns(new ReplaceOneResult.Acknowledged(1L, 1L, null));
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>("characters")).Returns(collectionMock.Object);

        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.AddField(1, 1, new AddFieldCommand("agility",
            new FieldCommandData { Name = "Agility", Description = "Agility stat", Value = 5 }));

        Assert.True(result.Success);
        Assert.Equal(200, result.StatusCode);
        var fields = (Dictionary<string, object?>)result.Data!["fields"];
        var agility = (Dictionary<string, object?>)fields["agility"];
        Assert.Equal(5, agility["value"]);
        Assert.Equal("Agility", agility["name"]);
    }

    [Fact]
    public void AddField_OverridesTemplateDefault()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData { Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Set<CharacterData>().Add(new CharacterData { Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100 });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData { Name = "TestChar", Description = "", Fields = new() });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData
            {
                Fields = new Dictionary<string, FieldMongoData>
                {
                    { "hp", new PropertyMongoData { Name = "HP", Description = "Health points", Value = 100 } }
                }
            });

        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        collectionMock.Setup(c => c.ReplaceOne(
            It.IsAny<FilterDefinition<CharacterMongoData>>(), It.IsAny<CharacterMongoData>(),
            It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()))
            .Returns(new ReplaceOneResult.Acknowledged(1L, 1L, null));
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>("characters")).Returns(collectionMock.Object);

        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.AddField(1, 1, new AddFieldCommand("hp", new FieldCommandData { Value = 75 }));

        Assert.True(result.Success);
        Assert.Equal(200, result.StatusCode);
        var fields = (Dictionary<string, object?>)result.Data!["fields"];
        var hp = (Dictionary<string, object?>)fields["hp"];
        Assert.Equal(75, hp["value"]);
    }

    [Fact]
    public void AddField_ExistingField_Returns409()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData { Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Set<CharacterData>().Add(new CharacterData { Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100 });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData
            {
                Name = "TestChar", Description = "",
                Fields = new Dictionary<string, FieldMongoData>
                {
                    { "agility", new PropertyMongoData { Name = "Agility", Description = "Agility stat", Value = 5 } }
                }
            });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.AddField(1, 1, new AddFieldCommand("agility", new FieldCommandData { Value = 9 }));

        Assert.False(result.Success);
        Assert.Equal(409, result.StatusCode);
    }

    [Fact]
    public void UpdateField_ChangesValue()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData { Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Set<CharacterData>().Add(new CharacterData { Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100 });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData
            {
                Name = "TestChar", Description = "",
                Fields = new Dictionary<string, FieldMongoData>
                {
                    { "agility", new PropertyMongoData { Name = "Agility", Description = "Agility stat", Value = 5 } }
                }
            });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        collectionMock.Setup(c => c.ReplaceOne(
            It.IsAny<FilterDefinition<CharacterMongoData>>(), It.IsAny<CharacterMongoData>(),
            It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()))
            .Returns(new ReplaceOneResult.Acknowledged(1L, 1L, null));
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>("characters")).Returns(collectionMock.Object);

        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.UpdateField(1, 1, new UpdateFieldCommand("agility", new FieldCommandData { Value = 8 }));

        Assert.True(result.Success);
        Assert.Equal(200, result.StatusCode);
        var fields = (Dictionary<string, object?>)result.Data!["fields"];
        var agility = (Dictionary<string, object?>)fields["agility"];
        Assert.Equal(8, agility["value"]);
    }

    [Fact]
    public void UpdateField_MissingField_Returns400()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData { Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Set<CharacterData>().Add(new CharacterData { Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100 });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData { Name = "TestChar", Description = "", Fields = new() });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.UpdateField(1, 1, new UpdateFieldCommand("agility", new FieldCommandData { Value = 8 }));

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
    }

    [Fact]
    public void DeleteField_RemovesField()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData { Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Set<CharacterData>().Add(new CharacterData { Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100 });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData
            {
                Name = "TestChar", Description = "",
                Fields = new Dictionary<string, FieldMongoData>
                {
                    { "agility", new PropertyMongoData { Name = "Agility", Description = "Agility stat", Value = 5 } }
                }
            });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var collectionMock = new Mock<IMongoCollection<CharacterMongoData>>(MockBehavior.Loose);
        collectionMock.Setup(c => c.ReplaceOne(
            It.IsAny<FilterDefinition<CharacterMongoData>>(), It.IsAny<CharacterMongoData>(),
            It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()))
            .Returns(new ReplaceOneResult.Acknowledged(1L, 1L, null));
        mongoMock.Setup(m => m.GetCollection<CharacterMongoData>("characters")).Returns(collectionMock.Object);

        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.DeleteField(1, 1, new DeleteFieldCommand("agility"));

        Assert.True(result.Success);
        Assert.Equal(200, result.StatusCode);
        var fields = (Dictionary<string, object?>)result.Data!["fields"];
        Assert.False(fields.ContainsKey("agility"));
    }

    [Fact]
    public void DeleteField_MissingField_Returns400NoOp()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Templates.Add(new TemplateData { Id = 100, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Set<CharacterData>().Add(new CharacterData { Id = 1, GroupId = 1, UUID = uuid, TemplateId = 100 });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<CharacterMongoData>("characters", uuid))
            .Returns(new CharacterMongoData { Name = "TestChar", Description = "", Fields = new() });
        mongoMock.Setup(m => m.GetEntity<TemplateMongoData>(
            It.Is<string>(c => c == MongoCollections.Templates), It.IsAny<string>()))
            .Returns(new TemplateMongoData { Fields = new() });

        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.DeleteField(1, 1, new DeleteFieldCommand("agility"));

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Equal("Nothing to do", result.Message);
    }

    [Fact]
    public void AddField_NonExistentCharacter_Returns404()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
        });

        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var chars = new CharactersProvider(ctx, mongoMock.Object, new Mock<ILogger<CharactersProvider>>().Object);
        var provider = new CommandsProvider(chars);

        var result = provider.AddField(1, 999, new AddFieldCommand("agility",
            new FieldCommandData { Name = "Agility", Description = "Agility stat", Value = 5 }));

        Assert.False(result.Success);
        Assert.Equal(404, result.StatusCode);
    }
}
