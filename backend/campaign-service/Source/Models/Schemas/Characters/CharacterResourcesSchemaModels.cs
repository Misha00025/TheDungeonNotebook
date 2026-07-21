namespace Tdn.Models.Schemas.Characters;

using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

public struct CharacterResourcesPostData
{
    public List<string> Fields { get; set; }
}

public class CharacterResourcesSchema
{
    public string Type = "characters";
    public List<string> Fields = new();
}

public class CharacterResourcesMongoData : GroupSchemaMongoData
{
    [BsonElement("fields")]
    public List<string> Fields = new();
}
