using MongoDB.Driver;
using Tdn.Db;

namespace Tdn.Models.Schemas;

public class GenericMongoProvider<TMongoData> where TMongoData : GroupSchemaMongoData
{
    private readonly ISchemasMongoDbContext _mongo;
    private readonly string _collectionName;
    private readonly string _type;

    public GenericMongoProvider(ISchemasMongoDbContext mongo, string collectionName, string type)
    {
        _mongo = mongo;
        _collectionName = collectionName;
        _type = type;
    }

    public TMongoData? GetSchema(int groupId) => GetSchema(groupId, _type);

    public TMongoData? GetSchema(int groupId, string type)
    {
        var filter = Builders<TMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, type)
        );
        return _mongo.GetCollection<TMongoData>(_collectionName).Find(query).FirstOrDefault();
    }

    public bool TrySaveSchema(int groupId, TMongoData data) => TrySaveSchema(groupId, data, _type);

    public bool TrySaveSchema(int groupId, TMongoData data, string type)
    {
        var filter = Builders<TMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, type)
        );
        var oldData = _mongo.GetCollection<TMongoData>(_collectionName).Find(query).FirstOrDefault();
        if (oldData == null)
        {
            _mongo.GetCollection<TMongoData>(_collectionName).InsertOne(data);
            return true;
        }
        else
        {
            data.Id = oldData.Id;
            var result = _mongo.GetCollection<TMongoData>(_collectionName)
                .ReplaceOne(query, data, new ReplaceOptions { IsUpsert = true });
            return result.ModifiedCount > 0;
        }
    }
}
