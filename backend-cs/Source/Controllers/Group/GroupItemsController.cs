using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;
using Tdn.Models.Saving;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Group)]
[Authorize(Policy.AccessLevel.Admin)]
[Route(TdnUriPath.GroupItems)]
public class GroupItemController : BaseController<Group>
{
	public struct InputItem
	{
		public string name {get;set;}
		public string description {get;set;}
	}
	private int GroupId => Container.ResourceInfo[Resource.Group].Id;
	protected override string GetUUID() => GroupId.ToString();
	
	private ItemProvider _itemProvider;
	private ItemSaver _itemsSaver;
	
	public GroupItemController(ItemProvider itemProvider, ItemSaver itemSaver)
	{
		_itemProvider = itemProvider;
		_itemsSaver = itemSaver;
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
	
	[HttpGet("{itemId}")]
	public ActionResult GetItem(int itemId)
	{
		var item = _itemProvider.GetModel(itemId.ToString());
		if (item == null)
			return NotFound();
		return Ok(item.ToDict());
	}
	
	[HttpPost]
	public ActionResult PostItem([FromBody, Required] InputItem input)
	{
		var item = new Item(new ItemInfo(){Name = input.name, Description = input.description, GroupId = GroupId});
		var itemId = _itemsSaver.CreateNew(item);
		return Created(TdnUriPath.CharacterItems+$"/{itemId}", item.ToDict());
	}
	
	[HttpPut("{itemId}")]
	public ActionResult PutItem(int itemId, [FromBody, Required] InputItem input)
	{
		var item = _itemProvider.GetModel(itemId.ToString());
		if (item is null || item.Info.GroupId != GroupId)
			return NotFound();
		var info = item.Info;
		info.Name = input.name;
		info.Description = input.description;
		item.UpdateInfo(info);
		_itemsSaver.SaveModel(item);
		return Created(TdnUriPath.CharacterItems+$"/{itemId}", item.ToDict());
	}
	
	[HttpDelete("{itemId}")]
	public ActionResult DeleteItem(int itemId)
	{
		var item = _itemProvider.GetModel(itemId.ToString());
		if (item == null)
			return NotFound();
		_itemsSaver.Delete(item);
		return Ok(null);
	}
}