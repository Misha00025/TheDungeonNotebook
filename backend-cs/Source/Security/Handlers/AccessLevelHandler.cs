using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace TdnApi.Security;

public class AccessLevelHandler : AuthorizationHandler<AccessLevelRequirement>
{
	protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, AccessLevelRequirement requirement)
	{
		var confirm = context.User.Claims.Any(e => e.Type == ClaimTypes.Role && TryStrToAccess(e.Value, out var accessLevel) && requirement.Verify(accessLevel));
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
			case "Admin":
				accessLevel = AccessLevel.Full;
				break;
			case "Moderator":
				accessLevel = AccessLevel.Write;
				break;
			case "Follower":
				accessLevel = AccessLevel.Read;
				break;
			default:
				accessLevel = AccessLevel.None;
				return false;
		}
		return true;
	}
}