using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Filters;
using TdnApi.Models.Db;
using TdnApi.Providers;
using static TdnApi.Fields;

namespace TdnApi.Security.Filters;

public abstract class BaseAccessAttribute : ActionFilterAttribute
{
	protected bool _adminsOnly {get; private set;} = false;
	public BaseAccessAttribute(bool adminsOnly = false)
	{
		_adminsOnly = adminsOnly;
	}
	
	protected bool IsUser(HttpContext context)
		=> context.User.FindAll(e => e.Type == ClaimTypes.Role).Any(e => e.Value == Role.User);
	
	protected bool IsGroup(HttpContext context)
		=> context.User.FindAll(e => e.Type == ClaimTypes.Role).Any(e => e.Value == Role.Group);
		
	protected bool IsAdmin(HttpContext context)
	{
		if (IsGroup(context))
			return true;
		var dbContext = context.RequestServices.GetService<TdnDbContext>();
		var accessId = context.User.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
		if (dbContext == null || !context.Request.Query.ContainsKey(GroupId) || accessId == null)
			return false;
		var groupId = context.Request.Query[GroupId];
		var provider = new GroupProvider(dbContext);
		var groups = provider.FindByUser(accessId);
		return groups.Any(e => e.GroupId == groupId && e.IsAdmin);
	}
}