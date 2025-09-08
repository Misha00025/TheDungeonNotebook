using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Tdn.Db.Contexts;

namespace Tdn.Api.Controllers;

public struct NotePostData
{
	public string Header { get; set; }
	public string Body { get; set; }
}

public abstract class BaseController<T> : ControllerBase
{
	private MongoDbContext _mongoDb;

	protected BaseController(MongoDbContext mongo)
	{
		_mongoDb = mongo;
	}
	

	protected abstract string CollectionName { get; }

	public MongoDB.Driver.IMongoCollection<T> Collection => _mongoDb.GetCollection<T>(CollectionName);

	protected bool IsDebug() => Request.Query.TryGetValue("debug", out var debugStr) && bool.TryParse(debugStr, out var debug) && debug;


	public override OkObjectResult Ok([ActionResultObjectValue] object? value)
	{
		return base.Ok(value);
	}

	public override CreatedResult Created(string? uri, [ActionResultObjectValue] object? value)
	{
		return base.Created(uri, value);
	}
	
	public ActionResult NotImplemented()
	{
	    return new ObjectResult(new { Message = "This feature is not implemented yet." })
		{
			StatusCode = StatusCodes.Status501NotImplemented
		};
	}
}