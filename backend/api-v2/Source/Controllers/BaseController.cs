using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Tdn.Models.Providing;
using Tdn.Models.Saving;

namespace Tdn.Api.Controllers;

public abstract class BaseController<T> : ControllerBase
{
	private IModelProvider<T>? _modelProvider;
	private IModelSaver<T>? _modelSaver;

	private IModelProvider<T> GetProvider()
	{
		if (_modelProvider == null)
			_modelProvider = HttpContext.RequestServices.GetRequiredService<IModelProvider<T>>();
		return _modelProvider;
	}
	
	private IModelSaver<T> GetSaver()
	{
		if (_modelSaver == null)
			_modelSaver = HttpContext.RequestServices.GetRequiredService<IModelSaver<T>>();
		return _modelSaver;
	}
	
	protected IModelProvider<T> ModelProvider => GetProvider();
	protected IModelSaver<T> ModelSaver => GetSaver();
	
	protected void SaveModel(T model)
	{
		var ok = ModelSaver.TrySaveModel(model);
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