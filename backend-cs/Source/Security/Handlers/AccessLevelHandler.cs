using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace Tdn.Security;

public static class AccessLevelAlias
{
	public const string Admin = "Admin";
	public const string Moderator = "Moderator";
	public const string Follower = "Follower";
}

public class AccessLevelHandler : AuthorizationHandler<AccessLevelRequirement>
{
	private bool Check(Claim e, AccessLevelRequirement requirement)
	{
		var isRole = e.Type == "AccessLevel";
		if (isRole)
		{
			if(TryStrToAccess(e.Value, out var accessLevel))
			{
				return requirement.Verify(accessLevel);
			}
		}
		return isRole;
	}
	
	protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, AccessLevelRequirement requirement)
	{
		var confirm = context.User.Claims.Any(e => Check(e, requirement));
		if (confirm)
			context.Succeed(requirement);
		else
			context.Fail();	
		return Task.CompletedTask;
	}
	
	private bool TryStrToAccess(string accessStr, out AccessLevel accessLevel)
	{
		switch(accessStr)
		{
			case AccessLevelAlias.Admin:
				accessLevel = AccessLevel.Full;
				break;
			case AccessLevelAlias.Moderator:
				accessLevel = AccessLevel.Write;
				break;
			case AccessLevelAlias.Follower:
				accessLevel = AccessLevel.Read;
				break;
			default:
				accessLevel = AccessLevel.None;
				return false;
		}
		return true;
	}
}