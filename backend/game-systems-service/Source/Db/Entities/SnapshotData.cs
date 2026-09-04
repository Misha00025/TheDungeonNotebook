using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

/// <summary>
/// Снимок контента версии игровой системы (MongoDB, коллекция snapshots).
/// Иммутабелен: новая версия = новый снимок.
/// </summary>
[BsonIgnoreExtraElements]
public class SnapshotData : MongoDbContext.MongoEntity
{
    [BsonElement("system_id")]
    public string SystemId { get; set; } = "";

    [BsonElement("version_id")]
    public string VersionId { get; set; } = "";

    [BsonElement("content")]
    public SnapshotContentData Content { get; set; } = new();

    [BsonElement("created_at")]
    public long CreatedAt { get; set; }
}
