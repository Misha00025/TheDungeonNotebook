using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Providing;
using Tdn.Security;

namespace Tdn.Api.Controllers;

public abstract class BaseController<T> : ControllerBase
{
	private readonly IModelProvider<T> _modelProvider;
	protected T model { get; private set; }
	
	protected readonly IAccessContext container;
	protected int SelfId => container.SelfId;
	
	public BaseController() 
	{
		var services = HttpContext.RequestServices;
		_modelProvider = services.GetRequiredService<IModelProvider<T>>();
		container = services.GetRequiredService<IAccessContext>();
		string uuid = GetUUID();
		model = _modelProvider.GetModel(uuid);
	}
	
	protected abstract string GetUUID();
	
	// TODO: Add method to get value from Request Route as some Type. For example: T GetFromRoute<T>(string name)
	protected bool TrySaveModel(T model) => _modelProvider.TrySaveModel(model);
	
	protected bool IsDebug() => Request.Query.TryGetValue("debug", out var debugStr) && bool.TryParse(debugStr, out var debug) && debug;
}