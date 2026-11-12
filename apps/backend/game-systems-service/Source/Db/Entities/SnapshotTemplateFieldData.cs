using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

/// <summary>
/// Поле шаблона листа персонажа.
/// </summary>
[BsonIgnoreExtraElements]
public class SnapshotTemplateFieldData
{
    [BsonElement("key")]
    public string Key { get; set; } = "";

    [BsonElement("label")]
    public string Label { get; set; } = "";

    [BsonElement("type")]
    public string Type { get; set; } = "scalar";

    [BsonElement("formula")]
    [BsonIgnoreIfNull]
    public string? Formula { get; set; }
}
