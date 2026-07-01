using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Settings;

namespace Tdn.Db;

public abstract class MongoDbContextBase
{
    public class MongoEntity
    {
        public ObjectId Id;
    }
    
    protected readonly IMongoDatabase _database;
    
    protected MongoDbContextBase(MongoDbSettingsBase mongoDbSettings)
    {
        var client = new MongoClient(mongoDbSettings.ConnectionString);
        _database = client.GetDatabase(mongoDbSettings.DatabaseName);
    }

    public IMongoCollection<T> GetCollection<T>(string collectionName)
    {
        return _database.GetCollection<T>(collectionName);
    }
    
    public T? GetEntity<T>(string collectionName, string uuid) where T : MongoEntity
    {
        ObjectId objectId = ObjectId.Parse(uuid);
        var collection = GetCollection<T>(collectionName);
        var filter = Builders<T>.Filter.Eq(e => e.Id, objectId);
        return collection.Find(filter).FirstOrDefault();
    }
    
    public IEnumerable<T> GetMany<T>(string collectionName, IEnumerable<string> uuids) where T : MongoEntity
    {
        List<T> result = new();
        foreach (var uuid in uuids)
        {
            var entity = GetEntity<T>(collectionName, uuid);
            if (entity != null)
                result.Add(entity);
        }
        return result.ToArray();
    }
}

public class MongoDbContext : MongoDbContextBase
{
    public MongoDbContext(MongoDbSettings settings) : base(settings) { }
}

public class SchemasMongoDbContext : MongoDbContextBase
{
    public SchemasMongoDbContext(SchemasMongoDbSettings settings) : base(settings) { }
}
