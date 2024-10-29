using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace TdnApi.Security
{
	public class AuthTypeHandler : AuthorizationHandler<AuthTypeRequirement>
	{
		protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, AuthTypeRequirement requirement)
		{
			var roles = context.User.FindAll(ClaimTypes.Role).ToList();
			if (roles.Count == 0)
			{
				
				return Task.CompletedTask;
			}
			var access = requirement.Access;
			bool confirm = false;
			switch (access)
			{
				case Access.All:
				case Access.UserOrGroup:	
					confirm = ConnectFrom(Role.Group, context) || ConnectFrom(Role.User, context);
					break;
				case Access.Group:
					confirm = ConnectFrom(Role.Group, context);
					break;
				case Access.User:
					confirm = ConnectFrom(Role.User, context);
					break;
			}
			if (!confirm)
				context.Fail();
			else
				context.Succeed(requirement);
			
			return Task.CompletedTask;
		}
		
		private bool ConnectFrom(string role, AuthorizationHandlerContext context) => context.User.HasClaim(e => e.Type == ClaimTypes.Role && e.Value == role);
		
	}
}