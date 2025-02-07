using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Tdn.Models.Providing;
using Tdn.Models.Saving;
using Tdn.Security;
using Tdn.Security.Conversions;

namespace Tdn.Api.Controllers;

public abstract class BaseController<T> : ControllerBase
{
	private IModelProvider<T>? _modelProvider;
	private IModelSaver<T>? _modelSaver;
	private T? _model;
	private IAccessContext? _container;

	private T? GetModel()
	{
		if (_model == null)
			_model = ModelProvider.GetModel(GetUUID());
		return _model;		
	}

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

	private IAccessContext GetAccessContext()
	{
		if (_container == null)
			_container = HttpContext.RequestServices.GetRequiredService<IAccessContext>();
		return _container;
	}
	
	protected IModelProvider<T> ModelProvider => GetProvider();
	protected IModelSaver<T> ModelSaver => GetSaver();
	protected T Model => GetModel()!;
	protected IAccessContext Container => GetAccessContext();
	
	protected int SelfId => Container.SelfId;
	
	protected virtual bool IsNotModelExist()
	{
		return GetModel() == null;
	}
	
	protected abstract string GetUUID();
	
	protected void SaveModel(T model)
	{
		var ok = ModelSaver.TrySaveModel(model);
		if (!ok)
			throw new Exception($"Can't save model: {model}");
	}
	
	// General
	protected bool IsDebug() => Request.Query.TryGetValue("debug", out var debugStr) && bool.TryParse(debugStr, out var debug) && debug;

	protected Dictionary<string, object?> PrepareResponse(object? value) => new Dictionary<string, object?>()
		{
			{"type", Container.AccessType},
			{"data", value},
			{"access_level", Container.ResourceInfo.First().Value.AccessLevel.ToAlias()}	
		};

	public override OkObjectResult Ok([ActionResultObjectValue] object? value)
	{
		return base.Ok(PrepareResponse(value));
	}

	public override CreatedResult Created(string? uri, [ActionResultObjectValue] object? value)
	{
		return base.Created(uri, PrepareResponse(value));
	}
}