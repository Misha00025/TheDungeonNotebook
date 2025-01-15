using MongoDB.Driver;
using Tdn.Settings;

namespace Tdn.Db;

public class MongoDbContext
{
	private readonly IMongoDatabase _database;
	
	public MongoDbContext(MongoDbSettings mongoDbSettings)
	{
		var client = new MongoClient(mongoDbSettings.ConnectionString);
		_database = client.GetDatabase(mongoDbSettings.DatabaseName);
	}

	public IMongoCollection<T> GetCollection<T>(string collectionName)
	{
		return _database.GetCollection<T>(collectionName);
	}
}