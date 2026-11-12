using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Db.Entities;

public class QuestMongoData : MongoDbContextBase.MongoEntity
{
    [BsonElement("header")]
    public string Header = "";
    [BsonElement("description")]
    public string Description = "";
    [BsonElement("reward")]
    public List<string> Reward = new();
    [BsonElement("status")]
    public string Status = "active";
    [BsonElement("objectives")]
    public List<ObjectiveMongoData> Objectives = new();
}

public class ObjectiveMongoData
{
    [BsonElement("key")]
    public string Key = "";
    [BsonElement("description")]
    public string Description = "";
    [BsonElement("status")]
    public string Status = "pending";
}
