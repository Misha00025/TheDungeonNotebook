using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Tdn.Models.Providing;
using Tdn.Models.Saving;

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
	
	protected IModelSaver<T> GetSaver<T>()
	{
		var saver = HttpContext.RequestServices.GetService<IModelSaver<T>>();
		if (saver == null)
			throw new System.Exception("Model saver is null");
		return saver;
	}
	
	protected void SaveModel<T>(T model)
	{
		var ok = GetSaver<T>().TrySaveModel(model);
		if (!ok)
			throw new Exception($"Can't save model: {model}");
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

public abstract class BaseController<T> : BaseController
{
	public IModelProvider<T> ModelProvider => GetProvider<T>();
	public IModelSaver<T> ModelSaver => GetSaver<T>();
}