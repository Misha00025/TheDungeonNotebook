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
public class FieldMongoData : NamedMongoElement
{
	[BsonElement("category")]
	public string? Category = null;
	[BsonElement("value")]
	public int Value;
	[BsonElement("formula")]
	public string? Formula = null;
	
	// Поля не используемые в БД
	[BsonIgnore]
	public int? CalculatedValue = null;
}

public class PropertyMongoData : FieldMongoData
{
	[BsonElement("max_value")]
	public int MaxValue;
}

public class ModifiedFieldMongoData : FieldMongoData
{
	[BsonElement("modifier")]
	public string ModifierFormula = ":value:";

	[BsonIgnore]
	public int Modifier;
}

public class CategorySchema
{
	[BsonElement("key")]
	public string Key { get; set; } = "";
	[BsonElement("name")]
	public string Name { get; set; } = "";
	[BsonElement("fields")]
	public List<string> Fields { get; set; } = new List<string>();
	[BsonElement("categories")]
	[BsonIgnoreIfNull]
	public List<CategorySchema>? Categories { get; set; } = null;
}

public class TemplateSchema
{
	public List<CategorySchema> Categories { get; set; } = new();
}

public class CharlistMongoData : GroupEntityMongoData 
{ 
	[BsonElement("fields")]
	public Dictionary<string, FieldMongoData> Fields { get; set; } = new();
	
	[BsonElement("schema")]
    public TemplateSchema? Schema { get; set; } = new();
}

public class ItemMongoData : GroupEntityMongoData 
{
	[BsonElement("price")]
	public int Price { get; set; } = 0;
	[BsonElement("image_link")]
	public string? Image;
}

public class AmountedItemMongoData : NamedMongoElement
{
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

public class AttributeMongoData
{
	[BsonElement("key")]
	public string Key = "";
	[BsonElement("name")]
	public string Name = "";
	[BsonElement("description")]
	public string Description = "";
	[BsonElement("is_filtered")]
	public bool IsFiltered = false;
	[BsonElement("known_values")]
	public List<string> KnownValues = new();
}

public class GroupAttributesMongoData : MongoDbContext.MongoEntity
{
	[BsonElement("group_id")]
	public int GroupId;

	[BsonElement("attributes")]
	public List<AttributeMongoData> Attributes = new();
}

public class ValuedAttributeMongoData
{
	[BsonElement("key")]
	public string Key = "";
	[BsonElement("value")]
	public string Value = "";
}

public class SkillMongoData : GroupEntityMongoData
{
	[BsonElement("attributes")]
	public List<ValuedAttributeMongoData> Attributes = new();
}