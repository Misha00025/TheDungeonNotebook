using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Group)]
[Authorize(Policy.AccessLevel.Follower)]
[Route(TdnUriPath.GroupCharlists)]
public class GroupCharlistsController : BaseController<Group>
{
	private int GroupId => Container.ResourceInfo[Resource.Group].Id;
	protected override string GetUUID() => GroupId.ToString();
	
	private CharlistProvider _charlistProvider;
	
	public GroupCharlistsController(CharlistProvider charlistProvider)
	{
		_charlistProvider = charlistProvider;
	}
		
	[HttpGet]
	public ActionResult GetCharlists()
	{
		var builder = Model.GetDictBuilder();
		builder.WithAdmins();
		if (Container.ResourceInfo[Resource.Group].AccessLevel == AccessLevel.Full)
			builder.WithUsers();
		builder.WithCharlists(_charlistProvider.GetCharlists(GroupId));
		return Ok(builder.Build());
	}
	
}