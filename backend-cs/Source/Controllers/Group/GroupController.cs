using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Group)]
[Authorize(Policy.AccessLevel.Follower)]
[Route(TdnUriPath.Group)]
public class GroupController : BaseController<Group>
{
	private int GroupId => Container.ResourceInfo[Resource.Group].Id;
	protected override string GetUUID() => GroupId.ToString();
		
	[HttpGet]
	public ActionResult GetInfo()
	{
		return Ok(Model.ToDict(addAdmins:true));
	}
	
	[Authorize(Policy.AccessLevel.Admin)]
	[HttpGet("users")]
	public ActionResult GetUsers()
	{
		return Ok(Model.ToDict(addAdmins:true, addUsers:true));
	}
	
}