using MongoDB.Driver;
using Tdn.Db;

namespace Tdn.Models.Groups.Items;

public class GroupSchemasProvider
{
    private const string COLLECTION_NAME = "schemas";

    public MongoDbContext _dbContext;
    
    
    public GroupSchemasProvider(MongoDbContext context)
    {
        _dbContext = context;
    }

    private Schema AsSchema(SchemaMongoData data)
    {
        return new()
        {
            Type = data.Type,
            GroupingAttributes = data.GroupingAttributes
            // FilterPresets = data.FilterPresets.Select(AsCategory).ToList()
        };
    }
    
    private SchemaMongoData AsData(int groupId, Schema schema)
    {
        return new ()
        {
            GroupId = groupId,
            Type = schema.Type,
            // FilterPresets = schema.FilterPresets.Select(e => new FilterPresetMongoData()
            // {
            //     Name = e.Name,
            //     Filters = e.Filters,
                
            // }).ToList()
        };
    }

    public Schema? GetSchema(int groupId, string type)
    {
        var filter = Builders<SchemaMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, type)
        );
        var mongoData = _dbContext.GetCollection<SchemaMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
        if (mongoData == null)
            return null;
        var schema = AsSchema(mongoData);
        return schema;
    }
    
    public bool TrySaveSchema(int groupId, Schema schema)
    {
        var filter = Builders<SchemaMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, schema.Type)
        );
        var oldData = _dbContext.GetCollection<SchemaMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
        var newData = AsData(groupId, schema);
        if (oldData == null)
        {
            _dbContext.GetCollection<SchemaMongoData>(COLLECTION_NAME).InsertOne(newData);
            return true;
        }
        else
        {
            newData.Id = oldData.Id;
            var result = _dbContext.GetCollection<SchemaMongoData>(COLLECTION_NAME)
            .ReplaceOne(
                query,
                newData,
                new ReplaceOptions { IsUpsert = true }
            );
            return result.ModifiedCount > 0;
        }       
    }
}