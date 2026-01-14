using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Models.Groups.Items;

public class FilterPresetMongoData
{
    [BsonElement("name")]
    public string Name = "";
    [BsonElement("filters")]
    public List<(string key, string value)> Filters = new();    
}

public class SchemaMongoData : MongoDbContext.MongoEntity
{
    [BsonElement("group_id")]
    public int GroupId;
    [BsonElement("type")]
    public string Type = "";
    [BsonElement("grouping_attributes")]
    public List<string> GroupingAttributes = new();
    // [BsonElement("presets")]
    // public List<FilterPresetMongoData> FilterPresets = new();
}