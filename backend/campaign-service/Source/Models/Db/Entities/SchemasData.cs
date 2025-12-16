using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

public class CategoryMongoData
{
    [BsonElement("title")]
    public string Title = "";
    
    [BsonElement("filters")]
    public List<(string key, string value)> Filters = new();
    
    [BsonElement("children")]
    public List<CategoryMongoData> Children = new();
    
}

public class SchemaMongoData : MongoDbContext.MongoEntity
{
    [BsonElement("group_id")]
    public int GroupId;
    [BsonElement("type")]
    public string Type = "";
    [BsonElement("categories")]
    public List<CategoryMongoData> Categories = new();
}