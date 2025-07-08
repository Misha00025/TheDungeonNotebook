using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

public abstract class BaseController : ControllerBase
{

	protected IModelProvider<T> GetProvider<T>()
	{
		var provider = HttpContext.RequestServices.GetService<IModelProvider<T>>();
		if (provider == null)
			throw new System.Exception("Model provider is null");
		return provider;
	}
	
	// General
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