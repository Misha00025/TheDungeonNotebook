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
	[BsonElement("value")]
	public int Value;
}
public class ItemMongoData : GroupEntityMongoData 
{
	[BsonElement("price")]
	public int Price { get; set; } = 0;
}

public class CharlistMongoData : GroupEntityMongoData 
{ 
	[BsonElement("fields")]
	public Dictionary<string, FieldMongoData> Fields { get; set; } = new();
}

public class NoteMongoData
{
	[BsonElement("header")]
	public string Header = "";
	[BsonElement("body")]
	public string Body = "";
	[BsonElement("addition_date")]
	public DateTime AdditionDate;
	[BsonElement("modified_date")]
	public DateTime ModifyDate;
}

public class AmountedItemMongoData
{
	[BsonElement("name")]
	public string Name = "";
	[BsonElement("description")]
	public string Description = "";
	[BsonElement("amount")]
	public int Amount;
	[BsonElement("image_link")]
	public string? Image;
}

public class CharacterMongoData : CharlistMongoData
{  
	[BsonElement("notes")]
	public List<NoteMongoData> Notes = new();
	[BsonElement("items")]
	public List<AmountedItemMongoData> Items = new();
}