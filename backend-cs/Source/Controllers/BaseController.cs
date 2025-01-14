using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TdnApi.Parsing.Http;

namespace Tdn.Api.Controllers;

public abstract class BaseController<Tdb> : ControllerBase where Tdb : DbContext
{
	protected readonly Tdb _dbContext; // TODO: Change to "_modelProvider" of IModelProvider type, where "IModelProvider" is interface with one method: TModel GetModel(int modelId) 
	// TODO: add field to contain current model
	protected readonly IHttpInfoContainer _container;
	protected int SelfId => _container.SelfId;
	
	public BaseController() 
	{
		var services = HttpContext.RequestServices;
		_dbContext = services.GetRequiredService<Tdb>();
		_container = services.GetRequiredService<IHttpInfoContainer>();
	}
	
	// TODO: Add method to get value from Request Route as some Type. For example: T GetFromRoute<T>(string name)
	
	protected bool IsDebug() => Request.Query.TryGetValue("debug", out var debugStr) && bool.TryParse(debugStr, out var debug) && debug;
}