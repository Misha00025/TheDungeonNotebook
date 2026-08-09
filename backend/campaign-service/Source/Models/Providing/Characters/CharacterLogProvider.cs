using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class CharacterLogProvider
{
    private readonly IMongoDbContext _mongo;

    public CharacterLogProvider(IMongoDbContext mongo)
    {
        _mongo = mongo;
    }

    private IMongoCollection<CharacterLogDocument> GetCollection() =>
        _mongo.GetCollection<CharacterLogDocument>(MongoCollections.CharacterLogs);

    public void PushEntry(int characterId, int groupId, CharacterLogEntry entry)
    {
        var filter = Builders<CharacterLogDocument>.Filter.Eq("character_id", characterId);
        var update = Builders<CharacterLogDocument>.Update
            .Push("entries", entry)
            .SetOnInsert(d => d.GroupId, groupId);
        GetCollection().UpdateOne(filter, update, new UpdateOptions { IsUpsert = true });
    }

    public void Log(int characterId, int groupId, int actorId, string actionType, Dictionary<string, object?> details)
    {
        if (actorId == -1) return; // admin / no subject — not logged
        var bsonDetails = new BsonDocument();
        foreach (var kv in details)
            if (kv.Value != null)
                bsonDetails[kv.Key] = BsonValue.Create(kv.Value);
        PushEntry(characterId, groupId, new CharacterLogEntry
        {
            Timestamp = DateTime.UtcNow,
            ActorId = actorId,
            ActionType = actionType,
            Details = bsonDetails
        });
    }

    public (List<CharacterLogEntryView> entries, int total) GetLog(int characterId, int limit = 50, int offset = 0)
    {
        var doc = GetCollection().Find(Builders<CharacterLogDocument>.Filter.Eq("character_id", characterId)).FirstOrDefault();
        if (doc == null)
            return (new List<CharacterLogEntryView>(), 0);

        var total = doc.Entries.Count;
        var entries = doc.Entries
            .OrderByDescending(e => e.Timestamp)
            .Skip(offset)
            .Take(limit)
            .Select(e => new CharacterLogEntryView
            {
                Timestamp = e.Timestamp,
                ActorId = e.ActorId,
                ActionType = e.ActionType,
                Details = ToDetailsDict(e.Details)
            })
            .ToList();

        return (entries, total);
    }

    public static Dictionary<string, object?> ToDetailsDict(BsonDocument doc)
    {
        var d = new Dictionary<string, object?>();
        foreach (var el in doc)
            d[el.Name] = BsonTypeMapper.MapToDotNetValue(el.Value);
        return d;
    }
}
