using System.Security.Claims;
using TdnApi.Models.Db;
using TdnApi.Providers;

namespace TdnApi.Security.Validators;

public class UserValidator
{
	private GroupProvider _groupProvider;
	private UserProvider _userProvider;
	
	public UserValidator(TdnDbContext context)
	{
		_groupProvider = new GroupProvider(context);
		_userProvider = new UserProvider(context);
	}
	
	public bool HasAccessToGroup(string groupId, ClaimsPrincipal user)
	{
		Predicate<string> validate = accessId =>
		{
			var groups = _groupProvider.FindByUser(accessId);
			return groups.Any(e => e.GroupId == groupId);
		};
		return HasAccess(Role.Group, groupId, user, validate);
	}
	
	public bool HasAccessToUser(string userId, ClaimsPrincipal user)
	{
		Predicate<string> validate = accessId =>
		{
			var users = _userProvider.FindByGroup(accessId);
			return users.Any(e => e.Id == userId);
		};
		return HasAccess(Role.User, userId, user, validate);
		
	}
	
	private bool HasAccess(string to, string id, ClaimsPrincipal user, Predicate<string> validate)
	{
		var accessId = user.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
		var role = user.FindFirst(e => e.Type == ClaimTypes.Role)?.Value;
		if (accessId == null)
			return false;
		if (role == to)
			return accessId == id;
		else
			return validate(accessId);
	}
}