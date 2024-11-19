

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.User)]
[Route("users/{user_id}")]
public class UserController : ControllerBase
{
	private UserContext _dbContext;
	public UserController(UserContext dbContext) 
	{
		_dbContext = dbContext;
	}
	
	[HttpGet]
	public ActionResult GetInfo()
	{
		return Ok();
	}
	
	[HttpGet("groups")]
	public ActionResult GetGroups()
	{
		return Ok();
	}
}