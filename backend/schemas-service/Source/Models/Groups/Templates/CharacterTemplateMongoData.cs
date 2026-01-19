using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Models.Groups.Templates;

public struct CategorySchemaPostData
{
    public string Name { get; set; }
    public List<string> Fields { get; set; }
    public List<CategorySchemaPostData>? Categories { get; set; }
}

public struct TemplateSchemaPostData
{
    public List<CategorySchemaPostData> Categories { get; set; }
}

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