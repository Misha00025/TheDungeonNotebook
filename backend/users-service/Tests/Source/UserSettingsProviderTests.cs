using MongoDB.Bson;
using Moq;
using Tdn.Db.Entities;
using Tdn.Models.Providing;
using Xunit;

namespace Tdn.Tests.Source;

public class UserSettingsProviderTests
{
    private static UserSettingsProvider MakeProvider(Mock<IUserSettingsStorage> storage) => new(storage.Object);

    private static Mock<IUserSettingsStorage> Stored(Dictionary<string, BsonValue>? settings, int userId = 1)
    {
        var m = new Mock<IUserSettingsStorage>();
        if (settings == null)
            m.Setup(s => s.Find(userId)).Returns((UserSettingsMongoData?)null);
        else
            m.Setup(s => s.Find(userId)).Returns(new UserSettingsMongoData { UserId = userId, Settings = settings });
        return m;
    }

    [Fact]
    public void Get_ReturnsOnlyRequestedKeys()
    {
        var storage = Stored(new Dictionary<string, BsonValue>
        {
            ["theme"] = BsonValue.Create("dark"),
            ["lang"] = BsonValue.Create("ru"),
            ["x"] = BsonValue.Create(1)
        });
        var p = MakeProvider(storage);
        var result = p.Get(1, new[] { "theme", "lang" });
        Assert.Equal(2, result.Count);
        Assert.True(result.ContainsKey("theme"));
        Assert.True(result.ContainsKey("lang"));
        Assert.False(result.ContainsKey("x"));
    }

    [Fact]
    public void Get_OmitsMissingKeys()
    {
        var storage = Stored(new Dictionary<string, BsonValue> { ["a"] = BsonValue.Create("1") });
        var p = MakeProvider(storage);
        var result = p.Get(1, new[] { "a", "doesNotExist" });
        Assert.Single(result);
        Assert.True(result.ContainsKey("a"));
    }

    [Fact]
    public void Get_ReturnsAll_WhenKeysNull()
    {
        var storage = Stored(new Dictionary<string, BsonValue> { ["a"] = BsonValue.Create("1"), ["b"] = BsonValue.Create("s") });
        var p = MakeProvider(storage);
        var result = p.Get(1, null);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public void Get_ReturnsEmpty_WhenNoDoc()
    {
        var p = MakeProvider(Stored(null));
        Assert.Empty(p.Get(1, null));
        Assert.Empty(p.Get(1, new[] { "a" }));
    }

    [Fact]
    public void Save_Inserts_WhenNoDoc()
    {
        var storage = new Mock<IUserSettingsStorage>();
        storage.Setup(s => s.Find(1)).Returns((UserSettingsMongoData?)null);
        var p = MakeProvider(storage);
        p.Save(1, new Dictionary<string, BsonValue> { ["k"] = BsonValue.Create("v") });
        storage.Verify(s => s.Insert(It.Is<UserSettingsMongoData>(d => d.UserId == 1 && d.Settings.ContainsKey("k"))), Times.Once);
        storage.Verify(s => s.Replace(It.IsAny<UserSettingsMongoData>()), Times.Never);
    }

    [Fact]
    public void Save_Merges_WhenDocExists()
    {
        var doc = new UserSettingsMongoData { UserId = 1, Settings = new Dictionary<string, BsonValue> { ["keep"] = BsonValue.Create("1") } };
        var storage = new Mock<IUserSettingsStorage>();
        storage.Setup(s => s.Find(1)).Returns(doc);
        var p = MakeProvider(storage);
        p.Save(1, new Dictionary<string, BsonValue> { ["new"] = BsonValue.Create("2") });
        Assert.True(doc.Settings.ContainsKey("keep"));
        Assert.True(doc.Settings.ContainsKey("new"));
        storage.Verify(s => s.Replace(doc), Times.Once);
        storage.Verify(s => s.Insert(It.IsAny<UserSettingsMongoData>()), Times.Never);
    }

    [Fact]
    public void Delete_RemovesOnlyGivenKeys()
    {
        var doc = new UserSettingsMongoData
        {
            UserId = 1,
            Settings = new Dictionary<string, BsonValue>
            {
                ["a"] = BsonValue.Create("1"), ["b"] = BsonValue.Create("2"), ["c"] = BsonValue.Create("3")
            }
        };
        var storage = new Mock<IUserSettingsStorage>();
        storage.Setup(s => s.Find(1)).Returns(doc);
        var p = MakeProvider(storage);
        p.Delete(1, new[] { "a", "c" });
        Assert.False(doc.Settings.ContainsKey("a"));
        Assert.False(doc.Settings.ContainsKey("c"));
        Assert.True(doc.Settings.ContainsKey("b"));
        storage.Verify(s => s.Replace(doc), Times.Once);
    }

    [Fact]
    public void Delete_NoOp_WhenNoDoc()
    {
        var storage = new Mock<IUserSettingsStorage>();
        storage.Setup(s => s.Find(1)).Returns((UserSettingsMongoData?)null);
        var p = MakeProvider(storage);
        p.Delete(1, new[] { "a" });
        storage.Verify(s => s.Replace(It.IsAny<UserSettingsMongoData>()), Times.Never);
    }
}
