using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

public class GroupEntityMongoData : MongoDbContext.MongoEntity
{
	[BsonElement("name")]
	public string Name = "";
	[BsonElement("description")]
	public string Description = "";
}

public class NamedMongoElement
{
	[BsonElement("name")]
	[BsonIgnoreIfDefault]
	public string Name = "";
	
	[BsonElement("description")]
	[BsonIgnoreIfDefault]
	public string Description = "";
}


[BsonKnownTypes(typeof(PropertyMongoData), typeof(ModifiedFieldMongoData))]
[BsonIgnoreExtraElements]
public class FieldMongoData : NamedMongoElement
{
	[BsonElement("value")]
	public int Value;
	[BsonElement("formula")]
	public string? Formula = null;
	
	// Поля не используемые в БД
	[BsonIgnore]
	public int? CalculatedValue = null;
}

[BsonIgnoreExtraElements]
public class PropertyMongoData : FieldMongoData
{
	[BsonElement("max_value")]
	public int MaxValue;
}

[BsonIgnoreExtraElements]
public class ModifiedFieldMongoData : FieldMongoData
{
	[BsonElement("modifier")]
	public string ModifierFormula = ":value:";

	[BsonIgnore]
	public int Modifier;
}



[BsonIgnoreExtraElements]
public class CharlistMongoData : GroupEntityMongoData 
{ 
	[BsonElement("fields")]
	public Dictionary<string, FieldMongoData> Fields { get; set; } = new();
}

public class AttributeMongoData
{
	[BsonElement("key")]
	public string Key { get; set; } = "";
	[BsonElement("name")]
	public string Name { get; set; } = "";
	[BsonElement("description")]
	public string Description { get; set; } = "";
	[BsonElement("is_filtered")]
	public bool IsFiltered { get; set; } = false;
	[BsonElement("known_values")]
	public List<string> KnownValues { get; set; } = new();
}

public class GroupAttributesMongoData : MongoDbContext.MongoEntity
{
	[BsonElement("group_id")]
	public int GroupId { get; set; }

	[BsonElement("attributes")]
	public List<AttributeMongoData> Attributes { get; set; } = new();
}

public class ValuedAttributeMongoData
{
	[BsonElement("key")]
	public string Key { get; set; } = "";
	[BsonElement("value")]
	public string Value { get; set; } = "";
}

[BsonIgnoreExtraElements]
public class AttributedMongoData : GroupEntityMongoData
{
	[BsonIgnoreIfDefault]
	[BsonElement("attributes")]
	public List<ValuedAttributeMongoData> Attributes = new();

	[BsonIgnoreIfNull]
	[BsonElement("is_secret")]
	public bool IsSecret;
}

[BsonIgnoreExtraElements]
public class ItemMongoData : AttributedMongoData
{
	[BsonElement("price")]
	public int Price { get; set; } = 0;
	[BsonElement("image_link")]
	public string? Image;
}

[BsonIgnoreExtraElements]
public class AmountedItemMongoData : NamedMongoElement
{
	[BsonElement("amount")]
	public int Amount;
	[BsonElement("price")]
	public int Price { get; set; } = 0;
	[BsonElement("image_link")]
	public string? Image;
}

[BsonIgnoreExtraElements]
public class CharacterMongoData : CharlistMongoData
{
	[BsonElement("items")]
	public List<AmountedItemMongoData> Items = new();

	[BsonElement("equipment")]
	[BsonIgnoreIfNull]
	public List<int>? Equipment;
}

[BsonIgnoreExtraElements]
public class SkillMongoData : AttributedMongoData
{
    
}