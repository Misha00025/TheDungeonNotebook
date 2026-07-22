using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class CharacterLogProvider
{
    private readonly MongoDbContext _mongo;

    public CharacterLogProvider(MongoDbContext mongo)
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

    public void LogFieldChange(int characterId, int groupId, int actorId, string fieldKey, int oldValue, int delta)
    {
        PushEntry(characterId, groupId, new CharacterLogEntry
        {
            Timestamp = DateTime.UtcNow,
            ActorId = actorId,
            ActionType = "field_change",
            Details = new LogDetails { Key = fieldKey, OldValue = oldValue, Delta = delta }
        });
    }

    public void LogItemChange(int characterId, int groupId, int actorId, int itemId, int oldValue, int delta)
    {
        PushEntry(characterId, groupId, new CharacterLogEntry
        {
            Timestamp = DateTime.UtcNow,
            ActorId = actorId,
            ActionType = "item_change",
            Details = new LogDetails { Key = itemId.ToString(), OldValue = oldValue, Delta = delta }
        });
    }

    public void LogSkillChange(int characterId, int groupId, int actorId, int skillId, int oldValue, int delta)
    {
        PushEntry(characterId, groupId, new CharacterLogEntry
        {
            Timestamp = DateTime.UtcNow,
            ActorId = actorId,
            ActionType = "skill_change",
            Details = new LogDetails { Key = skillId.ToString(), OldValue = oldValue, Delta = delta }
        });
    }

    public void LogEquipmentChange(int characterId, int groupId, int actorId, int itemId, int oldValue, int delta)
    {
        PushEntry(characterId, groupId, new CharacterLogEntry
        {
            Timestamp = DateTime.UtcNow,
            ActorId = actorId,
            ActionType = "equipment_change",
            Details = new LogDetails { Key = itemId.ToString(), OldValue = oldValue, Delta = delta }
        });
    }

    public (List<CharacterLogEntry> entries, int total) GetLog(int characterId, int limit = 50, int offset = 0)
    {
        var doc = GetCollection().Find(Builders<CharacterLogDocument>.Filter.Eq("character_id", characterId)).FirstOrDefault();
        if (doc == null)
            return (new List<CharacterLogEntry>(), 0);

        var total = doc.Entries.Count;
        var entries = doc.Entries
            .OrderByDescending(e => e.Timestamp)
            .Skip(offset)
            .Take(limit)
            .ToList();

        return (entries, total);
    }
}
