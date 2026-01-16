using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Models.Groups;

public class GroupSchemaMongoData : MongoDbContext.MongoEntity
{
    [BsonElement("group_id")]
    public int GroupId;
    [BsonElement("type")]
    public string Type = "";
}