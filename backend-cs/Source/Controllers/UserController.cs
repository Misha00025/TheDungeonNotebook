using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.User)]
[Authorize(Policy.AccessLevel.Admin)]
[Route("account")]
public class UserController : BaseController<User>
{
	protected override string GetUUID() => Container.ResourceInfo[Resource.User].Id.ToString();
	
	[HttpGet]
	public ActionResult GetInfo()
	{
		var model = Model;
		return Ok(model.ToDict());
	}
	
	[HttpGet("groups")]
	public ActionResult GetGroups()
	{
		return Ok(Model.ToDict(addGroups:true));
	}
}