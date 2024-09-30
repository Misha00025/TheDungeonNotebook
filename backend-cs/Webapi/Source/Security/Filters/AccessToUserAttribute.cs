using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Primitives;
using TdnApi.Models;
using TdnApi.Models.Db;
using TdnApi.Providers;
using static TdnApi.Fields;

namespace TdnApi.Security.Filters;

public class AccessToUserAttribute : BaseAccessAttribute
{
	public AccessToUserAttribute(bool adminsOnly = false) : base(adminsOnly)
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
		if (IsAdmin(context))
		{
			if (dbContext == null || !context.Request.Query.ContainsKey(UserId) 
				|| !context.Request.Query.ContainsKey(GroupId))
				return false;
			var groupId = context.Request.Query[GroupId].ToString();
			var userId = context.Request.Query[UserId].ToString();
			var provider = new UserProvider(dbContext);
			var users = provider.FindByGroup(groupId);
			return users.Any(e => e.Id == userId);
		}
		else
		{
			var accessId = context.User.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
			if (accessId == null)
				return false;
			if (!context.Request.Query.ContainsKey(UserId))
			{
				var query = context.Request.Query.ToDictionary();
				query.Add(UserId, new StringValues(accessId));
				context.Request.Query = new QueryCollection(query);
				return true;
			}
			else
				return context.Request.Query[UserId].ToString() == accessId;
		}
	}
	
	private bool GroupAccess(HttpContext context)
	{
		var accessId = context.User.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
		var dbContext = context.RequestServices.GetService<TdnDbContext>();
		if (context.Request.Query.ContainsKey(UserId) && dbContext != null)
		{
			var userId = context.Request.Query[UserId];
			return dbContext.UserGroups.Where(e => e.GroupId == accessId).Any(e => e.UserId == userId);
		}
		return false;
	}
}