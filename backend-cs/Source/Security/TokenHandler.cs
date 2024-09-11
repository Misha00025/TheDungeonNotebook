using Microsoft.AspNetCore.Authorization;

namespace TdnApi.Security
{
	public class TokenHandler : AuthorizationHandler<TokenRequirement>
	{
		protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, TokenRequirement requirement)
		{
			return Task.CompletedTask;
		}
	}
}