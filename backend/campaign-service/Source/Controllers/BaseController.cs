using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

public abstract class BaseController : ControllerBase
{	
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