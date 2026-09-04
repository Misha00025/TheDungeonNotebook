using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

/// <summary>
/// Контент снимка: предметы, навыки, шаблон персонажа.
/// </summary>
[BsonIgnoreExtraElements]
public class SnapshotContentData
{
    [BsonElement("items")]
    public List<SnapshotContentItemData> Items { get; set; } = new();

    [BsonElement("skills")]
    public List<SnapshotContentItemData> Skills { get; set; } = new();

    [BsonElement("character_template")]
    [BsonIgnoreIfNull]
    public SnapshotCharacterTemplateData? CharacterTemplate { get; set; }
}
