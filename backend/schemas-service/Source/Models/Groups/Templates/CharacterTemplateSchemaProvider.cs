using MongoDB.Driver;
using Tdn.Db;
using Tdn.Models.Groups.Items;

namespace Tdn.Models.Groups.Templates;

public class CharacterTemplateSchemaProvider
{
    private const string COLLECTION_NAME = "templates";
    private const string TYPE = "template";

    public MongoDbContext _dbContext;
    
    
    public CharacterTemplateSchemaProvider(MongoDbContext context)
    {
        _dbContext = context;
    }

    private CategorySchemaMongoData AsData(CategorySchemaPostData category) => new()
    {
        Name = category.Name,
        Fields = category.Fields,
        Categories = category.Categories?.Select(AsData).ToList()
    };

    private TemplateSchemaMongoData AsData(int groupId, TemplateSchemaPostData template) => new()
    {
        GroupId = groupId,
        Type = TYPE, 
        Categories = template.Categories.Select(AsData).ToList()
    };

    public TemplateSchemaMongoData? GetSchema(int groupId)
    {
        var filter = Builders<TemplateSchemaMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, TYPE)
        );
        var mongoData = _dbContext.GetCollection<TemplateSchemaMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
        if (mongoData == null)
            return null;
        return mongoData;
    }
    
    public bool TrySaveSchema(int groupId, TemplateSchemaPostData schema)
    {
        var filter = Builders<TemplateSchemaMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, TYPE)
        );
        var oldData = _dbContext.GetCollection<TemplateSchemaMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
        var newData = AsData(groupId, schema);
        if (oldData == null)
        {
            _dbContext.GetCollection<TemplateSchemaMongoData>(COLLECTION_NAME).InsertOne(newData);
            return true;
        }
        else
        {
            newData.Id = oldData.Id;
            var result = _dbContext.GetCollection<TemplateSchemaMongoData>(COLLECTION_NAME)
            .ReplaceOne(
                query,
                newData,
                new ReplaceOptions { IsUpsert = true }
            );
            return result.ModifiedCount > 0;
        }       
    }
}