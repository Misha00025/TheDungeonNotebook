using Microsoft.EntityFrameworkCore;
using Tdn.Db;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public abstract class MongoSQLModelProvider<TModel, TData, TMongoData> : SQLModelProvider<TModel, TData> where TData : IndexedData where TMongoData : MongoDbContext.MongoEntity
{
	private readonly MongoDbContext _mongoContext;

	public MongoSQLModelProvider(DbContext dbContext, MongoDbContext mongoContext) : base(dbContext)
	{
		_mongoContext = mongoContext;
	}
	protected MongoDbContext MongoContext => _mongoContext;
	
	protected abstract string CollectionName { get; }
	
	protected TMongoData? GetData(string uuid)
	{
		return MongoContext.GetEntity<TMongoData>(CollectionName, uuid);
	} 
}