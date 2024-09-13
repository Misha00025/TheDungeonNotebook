using System.Security.Claims;
using TdnApi.Models.Db;
using TdnApi.Providers;

namespace TdnApi.Security.Validators;

public class UserValidator
{
	private ClaimsPrincipal _user;
	private GroupProvider _groupProvider;
	private UserProvider _userProvider;
	
	public UserValidator(ClaimsPrincipal user, UserGroupContext context)
	{
		_user = user;
		_groupProvider = new GroupProvider(context);
		_userProvider = new UserProvider(context);
	}
	
	public bool HasAccessToGroup(string groupId)
	{
		Predicate<string> validate = accessId =>
		{
			var groups = _groupProvider.FindByUser(accessId);
			return groups.Any(e => e.Id == groupId);
		};
		return HasAccess(Role.Group, groupId, validate);
	}
	
	public bool HasAccessToUser(string userId)
	{
		Predicate<string> validate = accessId =>
		{
			var users = _userProvider.FindByGroup(accessId);
			return users.Any(e => e.Id == userId);
		};
		return HasAccess(Role.User, userId, validate);
		
	}
	
	private bool HasAccess(string to, string id, Predicate<string> validate)
	{
		var accessId = _user.FindFirst(e => e.Type == ClaimTypes.Name)?.Value;
		var role = _user.FindFirst(e => e.Type == ClaimTypes.Role)?.Value;
		if (accessId == null)
			return false;
		if (role == to)
			return accessId == id;
		else
			return validate(accessId);
	}
}