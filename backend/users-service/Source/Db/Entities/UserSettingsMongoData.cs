using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Db.Entities;

public class UserSettingsMongoData : MongoDbContext.MongoEntity
{
    [BsonElement("user_id")]
    public int UserId;
    [BsonElement("settings")]
    public Dictionary<string, BsonValue> Settings = new();
}
