using Microsoft.EntityFrameworkCore;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public abstract class SQLModelProvider<TModel, TContext, TData> : IModelProvider<TModel> 
			where TContext: DbContext where TData : IndexedData
{
	private int _lastId;
	private TData? _lastData;

	protected TContext _dbContext;
	
	public SQLModelProvider(TContext dbContext)
	{
		_dbContext = dbContext;
	}
	
	protected abstract TModel BuildModel(TData? data);
	
	protected TData? Find(int id)
	{
		if (id != _lastId)
		{
			_lastId = id;
			_lastData = _dbContext.Set<TData>().FirstOrDefault(e => e.Id == id);	
		}
		return _lastData;
	}
	
	public TModel GetModel(string uuid)
	{
		if (!int.TryParse(uuid, out int id))
			throw new Exception("Can't parse uuid to int to find User");
		var model = BuildModel(Find(id));
		return model;
	}
}