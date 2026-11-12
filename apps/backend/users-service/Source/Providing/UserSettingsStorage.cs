using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class UserSettingsStorage : IUserSettingsStorage
{
    private const string Collection = "settings";
    private readonly IMongoDbContext _mongo;

    public UserSettingsStorage(IMongoDbContext mongo)
    {
        _mongo = mongo;
    }

    private IMongoCollection<UserSettingsMongoData> Col() =>
        _mongo.GetCollection<UserSettingsMongoData>(Collection);

    public UserSettingsMongoData? Find(int userId) =>
        Col().Find(Builders<UserSettingsMongoData>.Filter.Eq(e => e.UserId, userId)).FirstOrDefault();

    public void Insert(UserSettingsMongoData doc) =>
        Col().InsertOne(doc);

    public void Replace(UserSettingsMongoData doc) =>
        Col().ReplaceOne(Builders<UserSettingsMongoData>.Filter.Eq(e => e.UserId, doc.UserId), doc);
}
