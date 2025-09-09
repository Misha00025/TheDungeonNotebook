using System.Text.Json.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using Tdn.Settings;

namespace Tdn.Db.Contexts;

public class MongoDbContext
{
	public class MongoEntity
	{
		[BsonId]
		public ObjectId Id;
	}
	
	private readonly IMongoDatabase _database;
	
	public MongoDbContext(MongoDbSettings mongoDbSettings)
	{
		var client = new MongoClient(mongoDbSettings.ConnectionString);
		_database = client.GetDatabase(mongoDbSettings.DatabaseName);
		IdGenerator = new NoteIdGenerator(this);
	}

	public NoteIdGenerator IdGenerator { get; private set; }

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