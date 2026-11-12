using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

/// <summary>
/// Шаблон листа персонажа внутри снимка.
/// </summary>
[BsonIgnoreExtraElements]
public class SnapshotCharacterTemplateData
{
    [BsonElement("fields")]
    public List<SnapshotTemplateFieldData> Fields { get; set; } = new();
}
