using Microsoft.EntityFrameworkCore;
using Tdn.Db;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public abstract class MongoSQLModelProvider<TModel, TData, TMongoData> : SQLModelProvider<TModel, TData> where TData : IndexedData where TMongoData : MongoDbContext.MongoEntity, new() where TModel : class
{
	protected readonly MongoDbContext _mongoContext;
	protected ILogger _logger;
	

	public MongoSQLModelProvider(DbContext dbContext, MongoDbContext mongoContext, ILogger<MongoSQLModelProvider<TModel, TData, TMongoData>> logger) : base(dbContext)
	{
		_mongoContext = mongoContext;
		_logger = logger;
	}
	protected MongoDbContext MongoContext => _mongoContext;
	
	protected abstract string CollectionName { get; }
	
	protected TMongoData GetMongoData(string uuid, Action<string>? onError = null)
	{
		var entity = MongoContext.GetEntity<TMongoData>(CollectionName, uuid);
		if (entity == null){
			_logger.LogWarning($"Inconsistent data between SQL and NoSQL: Item with UUID {uuid} does not exist in NoSQL. Creating new...");
			entity = new();
			var collection = _mongoContext.GetCollection<TMongoData>(CollectionName);
			collection.InsertOne(entity);
			if (onError != null)
				onError(entity.Id.ToString());
			_logger.LogInformation($"Item with UUID {entity.Id} created");
		}
		return entity;
	} 
}