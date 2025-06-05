using Microsoft.AspNetCore.Mvc;
using Tdn.Models;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("users")]
public class UserController : BaseController<User>
{
	
	[HttpGet]
	public ActionResult GetAll(string? groupId = null, bool isAdmin = false)
	{
		return NotImplemented();
	}
	
	[HttpGet("{userId}")]
	public ActionResult GetUser(string userId)
	{
		return NotImplemented();
	}

	[HttpPatch("{userId}")]
	public ActionResult PatchUser(string userId)
	{
		return NotImplemented();
	}
}