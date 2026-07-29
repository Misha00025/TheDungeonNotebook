using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

public abstract class CharactersBaseController : GroupsBaseController
{
    private IMongoDbContext _mongo;

    protected CharactersBaseController(CampaignContext context, IMongoDbContext mongo, GroupAccessHelper accessHelper) : base(context, accessHelper)
    {
        _mongo = mongo;
    }

    protected IMongoDbContext Mongo => _mongo;
    
    protected IMongoCollection<CharacterMongoData> GetCollection() => _mongo.GetCollection<CharacterMongoData>(MongoCollections.Characters);    
    
    protected List<(CharacterData metadata, CharacterMongoData character)>? GetCharacters(int groupId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var result = new List<(CharacterData, CharacterMongoData)>();
            var dataList = DbContext.Set<CharacterData>().Where(e => e.GroupId == groupId).Include(e => e.Group).Include(e => e.Template);
            foreach (var item in dataList)
                result.Add((item, _mongo.GetEntity<CharacterMongoData>(MongoCollections.Characters, item.UUID)!));
            return result;
        }
        return null;
    }
    
    protected bool TryGetCharacter(int groupId, int characterId, out CharacterData data, out CharacterMongoData character)
    {
        var tmpData = DbContext.Set<CharacterData>().Where(e => e.GroupId == groupId && e.Id == characterId).FirstOrDefault();
        var tmpCharacter = tmpData != null ? _mongo.GetEntity<CharacterMongoData>(MongoCollections.Characters, tmpData.UUID) : null;
        data = tmpData!;
        character = tmpCharacter!;
        return tmpData != null && tmpCharacter != null;
    }
}