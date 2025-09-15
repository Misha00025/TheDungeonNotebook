using MongoDB.Bson.Serialization.Attributes;
using Tdn.Models;

namespace Tdn.Db.Entities;

public class GroupEntityMongoData : MongoDbContext.MongoEntity
{
	[BsonElement("name")]
	public string Name = "";
	[BsonElement("description")]
	public string Description = "";
}
public class FieldMongoData 
{
	[BsonElement("name")]
	public string Name = "";
	[BsonElement("description")]
	public string Description = "";
	[BsonElement("category")]
	public string? Category = null;
	[BsonElement("value")]
	public int Value;
}
public class ItemMongoData : GroupEntityMongoData 
{
	[BsonElement("price")]
	public int Price { get; set; } = 0;
	[BsonElement("image_link")]
	public string? Image;
}

public class CategorySchema
{
    [BsonElement("key")]
    public string Key { get; set; } = "";
    [BsonElement("name")]
    public string Name { get; set; } = "";
    [BsonElement("fields")]
    public List<string> Fields { get; set; } = new List<string>();
}

public class CharlistMongoData : GroupEntityMongoData 
{ 
	[BsonElement("fields")]
	public Dictionary<string, FieldMongoData> Fields { get; set; } = new();
	[BsonElement("schema")]
    public List<CategorySchema>? Schema { get; set; } = new();
}

public class AmountedItemMongoData
{
	[BsonElement("name")]
	public string Name = "";
	[BsonElement("description")]
	public string Description = "";
	[BsonElement("amount")]
	public int Amount;
	[BsonElement("price")]
	public int Price { get; set; } = 0;
	[BsonElement("image_link")]
	public string? Image;
}

public class CharacterMongoData : CharlistMongoData
{
	[BsonElement("items")]
	public List<AmountedItemMongoData> Items = new();
}