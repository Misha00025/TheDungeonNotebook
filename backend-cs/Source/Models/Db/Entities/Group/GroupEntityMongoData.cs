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
	[BsonElement("amount")]
	public int? Amount; 
}
public class CharlistMongoData : GroupEntityMongoData 
{ 
	[BsonElement("fields")]
	public Dictionary<string, FieldMongoData> Fields { get; set; } = new();
}
public class CharacterMongoData : CharlistMongoData
{  }