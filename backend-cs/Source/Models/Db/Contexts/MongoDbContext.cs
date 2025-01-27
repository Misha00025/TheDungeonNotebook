using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db.Entities;
using Tdn.Settings;

namespace Tdn.Db;

public class MongoDbContext
{
	public class MongoEntity
	{
		public ObjectId Id;
	}
	
	private readonly IMongoDatabase _database;
	
	public MongoDbContext(MongoDbSettings mongoDbSettings)
	{
		var client = new MongoClient(mongoDbSettings.ConnectionString);
		_database = client.GetDatabase(mongoDbSettings.DatabaseName);
	}

	private IMongoCollection<T> GetCollection<T>(string collectionName)
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
}