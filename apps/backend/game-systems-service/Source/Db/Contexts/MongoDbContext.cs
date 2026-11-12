using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Settings;

namespace Tdn.Db;

public interface IMongoDbContext
{
    IMongoCollection<T> GetCollection<T>(string collectionName);
}

public abstract class MongoDbContextBase : IMongoDbContext
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
}

public class MongoDbContext : MongoDbContextBase
{
    public MongoDbContext(MongoDbSettings settings) : base(settings) { }
}
