using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.User)]
[Route("user")]
public class UserController : BaseController<UserContext>
{
	public UserController(UserContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
	}

	[HttpGet]
	public ActionResult GetInfo()
	{
		var user = _dbContext.Users.Where(e => e.Id == SelfId).First();
		return Ok(DataConverter.ConvertToDict(user));
	}
	
	[HttpGet("groups")]
	public ActionResult GetGroups()
	{
		var results = DataConverter.ConvertToListNullable(_dbContext.Groups.Where(e => e.UserId == SelfId).Include(e => e.Group), DataConverter.ConvertToDict);
		return Ok(results);
	}
}