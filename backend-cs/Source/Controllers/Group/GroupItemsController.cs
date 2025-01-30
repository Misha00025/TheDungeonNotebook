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
[Authorize(Policy.AccessLevel.Admin)]
[Route(TdnUriPath.GroupItems)]
public class GroupItemController : BaseController<Group>
{
	private int GroupId => Container.ResourceInfo[Resource.Group].Id;
	protected override string GetUUID() => GroupId.ToString();
	
	private ItemProvider _itemProvider;
	
	public GroupItemController(ItemProvider itemProvider)
	{
		_itemProvider = itemProvider;
	}
		
	[HttpGet]
	public ActionResult GetItems()
	{
		var builder = Model.GetDictBuilder();
		builder.WithAdmins();
		if (Container.ResourceInfo[Resource.Group].AccessLevel == AccessLevel.Full)
			builder.WithUsers();
		builder.WithItems(_itemProvider.GetItems(GroupId));
		return Ok(builder.Build());
	}
	
}