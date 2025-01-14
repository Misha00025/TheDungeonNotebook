using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Convertors;
using Tdn.Parsing.Http;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.User)]
[Route("user")]
public class UserController : BaseController<UserContext>
{
	public UserController() : base()
	{
	}

	[HttpGet]
	public ActionResult GetInfo()
	{
		var user = _dbContext.Users.Where(e => e.Id == SelfId).First();
		return Ok(user.ToDict());
	}
	
	[HttpGet("groups")]
	public ActionResult GetGroups()
	{
		var results = _dbContext.Groups.Where(e => e.UserId == SelfId).Include(e => e.Group).ManyConversions(e => e.ToDict());
		return Ok(results);
	}
}