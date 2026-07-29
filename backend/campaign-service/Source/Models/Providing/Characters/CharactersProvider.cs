using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class CharactersProvider : DualDbRepository<Character, CharacterData, CharacterMongoData>
{
    public CharactersProvider(CampaignContext context, IMongoDbContext mongoDbContext, ILogger<CharactersProvider> logger)
        : base(context, mongoDbContext, logger) { }

    protected override string CollectionName => "characters";
    protected override Expression<Func<CharacterData, bool>> GroupFilter(int groupId) => e => e.GroupId == groupId;
    protected override Expression<Func<CharacterData, bool>> IdFilter(int groupId, int entityId) => e => e.GroupId == groupId && e.Id == entityId;
    protected override int GetGroupId(Character entity) => entity.GroupId;
    protected override int GetEntityId(Character entity) => entity.Id;
    protected override void SetEntityId(Character entity, int id) => entity.Id = id;

    protected override Character ToDomain(CharacterData sqlData, CharacterMongoData mongoData) => new Character
    {
        Id = sqlData.Id,
        GroupId = sqlData.GroupId,
        TemplateId = sqlData.TemplateId,
        OwnerId = sqlData.OwnerId,
        Name = mongoData.Name,
        Description = mongoData.Description,
        Fields = mongoData.Fields,
        Items = mongoData.Items,
        Equipment = mongoData.Equipment,
    };

    protected override CharacterMongoData ToMongoData(Character entity) => new CharacterMongoData
    {
        Name = entity.Name,
        Description = entity.Description,
        Fields = entity.Fields,
        Items = entity.Items,
        Equipment = entity.Equipment,
    };

    public Character? GetCharacter(int groupId, int characterId) => Get(groupId, characterId);
    public IEnumerable<Character> GetCharacters(int groupId) => GetByGroup(groupId);

    public bool TryCreateCharacter(int groupId, Character character)
    {
        try
        {
            var mongoData = ToMongoData(character);
            Mongo.GetCollection<CharacterMongoData>(CollectionName).InsertOne(mongoData);
            var sqlData = new CharacterData
            {
                GroupId = groupId,
                TemplateId = character.TemplateId,
                OwnerId = character.OwnerId,
                UUID = mongoData.Id.ToString()
            };
            Db.Set<CharacterData>().Add(sqlData);
            Db.SaveChanges();
            character.Id = sqlData.Id;
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error creating character: {e}");
            return false;
        }
    }

    public bool TryUpdateCharacter(Character character)
    {
        try
        {
            var sqlData = Db.Set<CharacterData>()
                .FirstOrDefault(IdFilter(character.GroupId, character.Id));
            if (sqlData == null)
                return false;

            var mongoData = ToMongoData(character);
            mongoData.Id = new ObjectId(sqlData.UUID);

            var result = Mongo.GetCollection<CharacterMongoData>(CollectionName)
                .ReplaceOne(
                    Builders<CharacterMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)),
                    mongoData);
            return result.IsAcknowledged && result.ModifiedCount > 0;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error updating character: {e}");
            return false;
        }
    }

    public bool TryUpdateOwnerId(int groupId, int characterId, int? ownerId)
    {
        var sqlData = Db.Set<CharacterData>().FirstOrDefault(e => e.Id == characterId && e.GroupId == groupId);
        if (sqlData == null) return false;
        sqlData.OwnerId = ownerId;
        Db.SaveChanges();
        return true;
    }

    public bool TryDeleteCharacter(int groupId, int characterId)
    {
        try
        {
            var sqlData = Db.Set<CharacterData>().FirstOrDefault(IdFilter(groupId, characterId));
            if (sqlData == null)
                return false;
            Mongo.GetCollection<CharacterMongoData>(CollectionName)
                .DeleteOne(Builders<CharacterMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)));
            Db.Set<CharacterData>().Remove(sqlData);
            Db.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error deleting character: {e}");
            return false;
        }
    }

    public TemplateMongoData? GetTemplate(int groupId, int templateId)
    {
        var templateData = Db.Set<TemplateData>()
            .Where(e => e.GroupId == groupId && e.Id == templateId)
            .FirstOrDefault();
        if (templateData == null) return null;
        return Mongo.GetEntity<TemplateMongoData>(MongoCollections.Templates, templateData.UUID);
    }
}
