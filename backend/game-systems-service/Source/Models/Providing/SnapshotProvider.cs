using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

/// <summary>
/// Работа со снимками контента версий в MongoDB (коллекция snapshots).
/// Снимок иммутабелен: новая версия = новый снимок.
/// </summary>
public class SnapshotProvider
{
    private const string CollectionName = "snapshots";
    private readonly IMongoDbContext _mongo;

    public SnapshotProvider(IMongoDbContext mongo)
    {
        _mongo = mongo;
    }

    public string CreateSnapshot(string systemId, string versionId, SnapshotContentData content)
    {
        var snapshot = new SnapshotData
        {
            SystemId = systemId,
            VersionId = versionId,
            Content = content,
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        };
        _mongo.GetCollection<SnapshotData>(CollectionName).InsertOne(snapshot);
        return snapshot.Id.ToString();
    }

    public SnapshotData? GetSnapshot(string snapshotId)
    {
        if (!MongoDB.Bson.ObjectId.TryParse(snapshotId, out var objectId))
            return null;
        return _mongo.GetCollection<SnapshotData>(CollectionName)
            .Find(e => e.Id == objectId)
            .FirstOrDefault();
    }
}
