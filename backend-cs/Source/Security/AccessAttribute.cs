using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc;


namespace TdnApi.Security;

public enum Access
{
	All = 0,
	User = 1,
	Group = 2,
	UserOrGroup = Access.User + Access.Group
}

public class CheckAccessAttribute : ActionFilterAttribute
{
	private const string _headerName = "token";
	private const string _expectedValue = "5";
	private readonly int _accessLevel;
	
	public CheckAccessAttribute(Access access) => new CheckAccessAttribute((int)access);
	
	public CheckAccessAttribute(int accessLevel = (int)Access.All) : base()
	{
		_accessLevel = accessLevel;
	}
	
	public override void OnActionExecuting(ActionExecutingContext context)
	{		
		if (!context.HttpContext.Request.Headers.TryGetValue(_headerName, out var headerValue) ||
			headerValue != _expectedValue)
		{
			context.Result = new ForbidResult();
		}
		base.OnActionExecuting(context);
		// switch ((Access)_accessLevel)
		// {
		// 	case Access.All:
		// 		return;
		// 	case Access.User:
		// 		if (IsUser(context))
		// 			return;  
		// 		break;
		// 	case Access.Group:
		// 		if (IsGroup(context))
		// 			return;
		// 		break; 
		// 	case Access.UserOrGroup:
		// 		if (IsUser(context) || IsGroup(context))
		// 			return; 
		// 		break;
		// }
		// context.Result = new UnauthorizedResult();
	}
	
	private bool IsUser(AuthorizationFilterContext context)
	{
		var headers = context.HttpContext.Response.Headers;
		bool hasToken = headers.ContainsKey("token");
		bool access = hasToken;
		return access;
	}
	
	private bool IsGroup(AuthorizationFilterContext context)
	{
		var headers = context.HttpContext.Response.Headers;
		bool hasToken = headers.ContainsKey("serviceToken");
		bool access = hasToken;
		return access;
	}
}
