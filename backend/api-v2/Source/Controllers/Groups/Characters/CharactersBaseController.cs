using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Api.Controllers;

public abstract class CharactersBaseController : GroupsBaseController
{
    private EntityContext _dbContext;
    private MongoDbContext _mongo;

    protected CharactersBaseController(EntityContext context, MongoDbContext mongo, GroupContext groupContext) : base(groupContext)
    {
        _dbContext = context;
        _mongo = mongo;
    }

    protected EntityContext DbContext => _dbContext;
    protected MongoDbContext Mongo => _mongo;
    
    protected IMongoCollection<CharacterMongoData> GetCollection() => _mongo.GetCollection<CharacterMongoData>(MongoCollections.Characters);    
    
    protected List<(CharacterData metadata, CharacterMongoData character)>? GetCharacters(int groupId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var result = new List<(CharacterData, CharacterMongoData)>();
            var dataList = _dbContext.Set<CharacterData>().Where(e => e.GroupId == groupId).Include(e => e.Group).Include(e => e.Template);
            foreach (var item in dataList)
                result.Add((item, _mongo.GetEntity<CharacterMongoData>(MongoCollections.Characters, item.UUID)!));
            return result;
        }
        return null;
    }
    
    protected bool TryGetCharacter(int groupId, int characterId, out CharacterData data, out CharacterMongoData character)
    {
        var tmpData = _dbContext.Set<CharacterData>().Where(e => e.GroupId == groupId && e.Id == characterId).FirstOrDefault();
        var tmpCharacter = tmpData != null ? _mongo.GetEntity<CharacterMongoData>(MongoCollections.Characters, tmpData.UUID) : null;
        data = tmpData!;
        character = tmpCharacter!;
        return tmpData != null && tmpCharacter != null;
    }
}