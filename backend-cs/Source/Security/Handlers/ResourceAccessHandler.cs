using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Tdn.Security.Conversions;
using Tdn.Parsing.Http;

namespace Tdn.Security;

public class ResourceAccessHandler : AuthorizationHandler<ResourceRequirement>
{
	private readonly IAccessContext _infoContainer;	
	public ResourceAccessHandler(IAccessContext infoContainer) : base()
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
        identity?.AddClaim(new Claim("AccessLevel", access.ToAlias()));
		return Task.CompletedTask;
	}
}