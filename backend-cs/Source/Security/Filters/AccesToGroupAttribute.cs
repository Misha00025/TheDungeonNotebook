using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Primitives;
using static TdnApi.Fields;

namespace TdnApi.Security.Filters;

public class AccessToGroupAttribute : ActionFilterAttribute
{
	public override void OnActionExecuting(ActionExecutingContext filterContext)
	{		
		var context = filterContext.HttpContext;
		if (!HasAccess(context))
			filterContext.Result = new ForbidResult();
		base.OnActionExecuting(filterContext);
	}
	
	private bool HasAccess(HttpContext context)
	{
		var accessId = context.User.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
		var role = context.User.FindFirst(e => e.Type == ClaimTypes.Role)?.Value;
		// Console.WriteLine("--------------------------");
		// Console.WriteLine(context.Request.QueryString);
		// Console.WriteLine("--------------------------");
		if (role == Role.Group)
			if (context.Request.Query.ContainsKey(GroupId))
			{
				return accessId == context.Request.Query[GroupId];
			}
			else
			{
				var query = context.Request.Query.ToDictionary();
				query.Add(GroupId, new StringValues(accessId));
				context.Request.Query = new QueryCollection(query);
				return true;	
			}
		if (role == Role.User)
			if (context.Request.Query.ContainsKey(GroupId))
			{
				
			}
		return false;
	}
}
