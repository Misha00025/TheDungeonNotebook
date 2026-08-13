using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Models.Schemas.Items;

public class Schema 
{
    public string Type = "";
    public List<string> GroupingAttributes = new();
    // public List<FilterPreset> FilterPresets = new();
}

public class SchemaMongoData : GroupSchemaMongoData
{
    [BsonElement("grouping_attributes")]
    public List<string> GroupingAttributes = new();
    // [BsonElement("presets")]
    // public List<FilterPresetMongoData> FilterPresets = new();
}

public class SkillsSchemaMongoData : SchemaMongoData
{
    public SkillsSchemaMongoData() => Type = "skills";
}

public class ItemsSchemaMongoData : SchemaMongoData
{
    public ItemsSchemaMongoData() => Type = "items";
}
