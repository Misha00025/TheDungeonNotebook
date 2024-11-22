using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TdnApi.Parsing.Http;

namespace Tdn.Api.Controllers;

public abstract class BaseController<Tdb> : ControllerBase where Tdb : DbContext
{
	protected readonly Tdb _dbContext;
	protected readonly IHttpInfoContainer _container;
	
	public BaseController(Tdb dbContext, IHttpInfoContainer container) 
	{
		_dbContext = dbContext;
		_container = container;
	}
	
	protected bool IsDebug() => Request.Query.TryGetValue("debug", out var debugStr) && bool.TryParse(debugStr, out var debug) && debug;
}