using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using TdnApi.Parsing.Http;

namespace TdnApi.Security;

public class ResourceAccessHandler : AuthorizationHandler<ResourceRequirement>
{
	private readonly IHttpInfoContainer _infoContainer;	
	public ResourceAccessHandler(IHttpInfoContainer infoContainer) : base()
	{
		_infoContainer = infoContainer;
	}
	
	protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, ResourceRequirement requirement)
	{
		var access = AccessLevel.None;
		
		if (_infoContainer.ResourceInfo.ContainsKey(requirement.Resource))
			access = _infoContainer.ResourceInfo[requirement.Resource].AccessLevel;
			
		if (access == AccessLevel.None)
			context.Fail();			
		else
			context.Succeed(requirement);
		var identity = context.User.Identity as ClaimsIdentity;
        identity?.AddClaim(new Claim("AccessLevel", AccessLevelAlias.Convert(access)));
		return Task.CompletedTask;
	}
}