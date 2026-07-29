using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Models.Schemas.Templates;

public class CategorySchemaMongoData
{
	[BsonElement("name")]
	public string Name { get; set; } = "";
	[BsonElement("fields")]
	public List<string> Fields { get; set; } = new List<string>();
	[BsonElement("categories")]
	[BsonIgnoreIfNull]
	public List<CategorySchemaMongoData>? Categories { get; set; } = null;
	[BsonElement("key")]
	[BsonIgnoreIfNull]
	public string Key { get; set; } = "";
}

public class TemplateSchemaMongoData : GroupSchemaMongoData
{
    [BsonElement("categories")]
	public List<CategorySchemaMongoData> Categories { get; set; } = new();
}
