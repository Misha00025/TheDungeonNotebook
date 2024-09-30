using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Primitives;
using TdnApi.Models.Db;
using TdnApi.Providers;
using static TdnApi.Fields;

namespace TdnApi.Security.Filters;

public class AccessToGroupAttribute : BaseAccessAttribute
{
	public AccessToGroupAttribute(bool adminsOnly = false) : base(adminsOnly)
	{
	}
	
	public override void OnActionExecuting(ActionExecutingContext filterContext)
	{		
		var context = filterContext.HttpContext;
		if (!HasAccess(context))
			filterContext.Result = new ForbidResult();
		var isAdmin = IsAdmin(context);
		if (isAdmin)
			if (context.User.Identity is ClaimsIdentity identity)
			{
				identity.AddClaim(new Claim(ClaimTypes.Role, Role.GroupAdmin));
				context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
			}
		if (_adminsOnly && !isAdmin)
			filterContext.Result = new ForbidResult();		
		base.OnActionExecuting(filterContext);
	}
	
	private bool HasAccess(HttpContext context)
	{
		if (IsGroup(context))
			return GroupAccess(context);
		if (IsUser(context))
			return UserAccess(context);
		return false;
	}
	
	private bool UserAccess(HttpContext context)
	{
		var dbContext = context.RequestServices.GetService<TdnDbContext>();
		var accessId = context.User.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
		if (dbContext == null || !context.Request.Query.ContainsKey(GroupId) || accessId == null)
			return false;
		var groupId = context.Request.Query[GroupId];
		var provider = new GroupProvider(dbContext);
		var groups = provider.FindByUser(accessId);
		return groups.Any(e => e.GroupId == groupId);
	}
	
	private bool GroupAccess(HttpContext context)
	{
		var accessId = context.User.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
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
	}
}
