using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Tdn.Models.Providing;
using Tdn.Security;
using Tdn.Security.Conversions;

namespace Tdn.Api.Controllers;

public abstract class BaseController<T> : ControllerBase
{

	private IModelProvider<T>? _modelProvider;	
	private T? _model;
	private IAccessContext? _container;
	
	protected IModelProvider<T> ModelProvider => GetProvider();
	protected T Model => GetModel();
	protected IAccessContext Container => GetAccessContext();
	
	protected int SelfId => Container.SelfId;

	private T GetModel()
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

	private IAccessContext GetAccessContext()
	{
		if (_container == null)
			_container = HttpContext.RequestServices.GetRequiredService<IAccessContext>();
		return _container;
	}
	
	protected abstract string GetUUID();
	
	// TODO: Add method to get value from Request Route as some Type. For example: T GetFromRoute<T>(string name)
	protected bool TrySaveModel(T model) => throw new NotImplementedException();
	
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