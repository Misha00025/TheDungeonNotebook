using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Route("characters/{character_id}/inventories")]
public class InventoryController : BaseController<InventoryContext>
{
	public InventoryController(InventoryContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
	}
	
	[HttpGet]
	public ActionResult GetInventories(int character_id)
	{
		return Ok();
	}
	
	[HttpPost]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddInventory(int character_id)
	{
		if (IsDebug())
			return Created("", "");
		return Created("", "");
	}
	
	[HttpGet("{inventory_id}")]
	public ActionResult GetInventory(int character_id, int inventory_id)
	{
		if (IsDebug())
			return GetInventoryDebug(character_id, inventory_id);
		return Ok();
	}
	
	[HttpDelete("{inventory_id}")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult DeleteInventory(int character_id, int inventory_id)
	{
		if (IsDebug())
			return GetInventoryDebug(character_id, inventory_id);
		return Ok();
	}
	
	private ActionResult GetInventoryDebug(int character_id, int inventory_id)
	{
		if (character_id == 10 && !(inventory_id == 1 || inventory_id == 4))
			return NotFound();
		if (character_id == 9 && inventory_id != 2)
			return NotFound();
		return Ok();
	}
}