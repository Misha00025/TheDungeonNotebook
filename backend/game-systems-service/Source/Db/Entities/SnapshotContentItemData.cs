using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

/// <summary>
/// Элемент контента снимка (предмет / навык / поле шаблона).
/// </summary>
[BsonIgnoreExtraElements]
public class SnapshotContentItemData
{
    [BsonElement("id")]
    public string Id { get; set; } = "";

    [BsonElement("name")]
    public string Name { get; set; } = "";

    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    [BsonElement("properties")]
    [BsonIgnoreIfNull]
    public Dictionary<string, object>? Properties { get; set; }

    [BsonElement("price")]
    [BsonIgnoreIfDefault]
    public int Price { get; set; }

    [BsonElement("rarity")]
    [BsonIgnoreIfNull]
    public string? Rarity { get; set; }
}
