using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.User)]
[Authorize(Policy.AccessLevel.Admin)]
[Route("account")]
public class UserController : BaseController<User>
{
	public UserController(ILogger logger)
	{
		logger.LogDebug("User Controller Created");
	}
	
	protected override string GetUUID() => container.ResourceInfo[Resource.User].Id.ToString();
	
	
}