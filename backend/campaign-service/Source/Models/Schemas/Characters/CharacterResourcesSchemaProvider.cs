using MongoDB.Driver;
using Tdn.Db;

namespace Tdn.Models.Schemas.Characters;

public class CharacterResourcesSchemaProvider
{
    private const string COLLECTION_NAME = "schemas";
    private const string TYPE = "characters";

    public SchemasMongoDbContext _dbContext;
    
    
    public CharacterResourcesSchemaProvider(SchemasMongoDbContext context)
    {
        _dbContext = context;
    }

    public CharacterResourcesMongoData? GetSchema(int groupId)
    {
        var filter = Builders<CharacterResourcesMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, TYPE)
        );
        var mongoData = _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
        if (mongoData == null)
            return null;
        return mongoData;
    }
    
    public bool TrySaveSchema(int groupId, CharacterResourcesSchema schema)
    {
        var filter = Builders<CharacterResourcesMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, TYPE)
        );
        var oldData = _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
        var newData = new CharacterResourcesMongoData
        {
            GroupId = groupId,
            Type = TYPE,
            Fields = schema.Fields
        };
        if (oldData == null)
        {
            _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME).InsertOne(newData);
            return true;
        }
        else
        {
            newData.Id = oldData.Id;
            var result = _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME)
            .ReplaceOne(
                query,
                newData,
                new ReplaceOptions { IsUpsert = true }
            );
            return result.ModifiedCount > 0;
        }       
    }
}
