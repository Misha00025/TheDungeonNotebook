using MongoDB.Bson;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class UserSettingsProvider
{
    private readonly IUserSettingsStorage _storage;

    public UserSettingsProvider(IUserSettingsStorage storage)
    {
        _storage = storage;
    }

    // Returns ONLY the requested keys (missing/unknown keys omitted).
    // keys == null -> returns ALL settings. Empty dict when no doc exists.
    public Dictionary<string, BsonValue> Get(int userId, IEnumerable<string>? keys)
    {
        var doc = _storage.Find(userId);
        if (doc == null) return new Dictionary<string, BsonValue>();
        if (keys == null) return new Dictionary<string, BsonValue>(doc.Settings);
        return keys
            .Where(k => doc.Settings.ContainsKey(k))
            .ToDictionary(k => k, k => doc.Settings[k]);
    }

    // Upsert/merge provided key->value map into the user's document.
    public void Save(int userId, Dictionary<string, BsonValue> values)
    {
        var doc = _storage.Find(userId);
        if (doc == null)
        {
            _storage.Insert(new UserSettingsMongoData { UserId = userId, Settings = values });
            return;
        }
        foreach (var kv in values)
            doc.Settings[kv.Key] = kv.Value;
        _storage.Replace(doc);
    }

    // Remove ONLY the given keys. No-op if no document exists.
    public void Delete(int userId, IEnumerable<string> keys)
    {
        var doc = _storage.Find(userId);
        if (doc == null) return;
        foreach (var k in keys)
            doc.Settings.Remove(k);
        _storage.Replace(doc);
    }
}
