using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class CharacterEquipmentProvider
{
    private readonly CampaignContext _db;
    private readonly IMongoDbContext _mongo;

    public CharacterEquipmentProvider(
        CampaignContext context,
        IMongoDbContext mongo)
    {
        _db = context;
        _mongo = mongo;
    }

    public List<int> GetEquipment(int groupId, int characterId)
    {
        var character = LoadCharacter(groupId, characterId);
        return character?.Equipment ?? new List<int>();
    }

    public bool TryAddEquipment(int groupId, int characterId, int itemId)
    {
        try
        {
            var collection = _mongo.GetCollection<CharacterMongoData>(MongoCollections.Characters);
            var filter = BuildFilter(groupId, characterId);
            var update = Builders<CharacterMongoData>.Update.AddToSet("equipment", itemId);
            var result = collection.UpdateOne(filter, update);
            return result.ModifiedCount > 0;
        }
        catch
        {
            return false;
        }
    }

    public bool TryRemoveEquipment(int groupId, int characterId, int itemId)
    {
        try
        {
            var collection = _mongo.GetCollection<CharacterMongoData>(MongoCollections.Characters);
            var filter = BuildFilter(groupId, characterId);
            var update = Builders<CharacterMongoData>.Update.Pull("equipment", itemId);
            var result = collection.UpdateOne(filter, update);
            return result.ModifiedCount > 0;
        }
        catch
        {
            return false;
        }
    }

    public bool TrySaveEquipment(int groupId, int characterId, List<int> itemIds)
    {
        try
        {
            var collection = _mongo.GetCollection<CharacterMongoData>(MongoCollections.Characters);
            var filter = BuildFilter(groupId, characterId);
            var update = Builders<CharacterMongoData>.Update.Set("equipment", itemIds);
            var result = collection.UpdateOne(filter, update);
            return result.ModifiedCount > 0;
        }
        catch
        {
            return false;
        }
    }

    private CharacterMongoData? LoadCharacter(int groupId, int characterId)
    {
        var charData = _db.Characters
            .FirstOrDefault(e => e.GroupId == groupId && e.Id == characterId);
        if (charData == null) return null;
        return _mongo.GetEntity<CharacterMongoData>(MongoCollections.Characters, charData.UUID);
    }

    private FilterDefinition<CharacterMongoData> BuildFilter(int groupId, int characterId)
    {
        var charData = _db.Characters
            .FirstOrDefault(e => e.GroupId == groupId && e.Id == characterId);
        if (charData == null)
            return Builders<CharacterMongoData>.Filter.Eq("_id", MongoDB.Bson.ObjectId.Empty);

        return Builders<CharacterMongoData>.Filter.Eq(e => e.Id, new MongoDB.Bson.ObjectId(charData.UUID));
    }
}
