

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.User)]
[Route("users/{user_id}")]
public class UserController : BaseController<CharacterContext>
{
    public UserController(CharacterContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
    {
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