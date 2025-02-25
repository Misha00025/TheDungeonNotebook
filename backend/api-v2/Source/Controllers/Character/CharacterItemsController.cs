using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Authorize(Policy.AccessLevel.Follower)]
[Route(TdnUriPath.CharacterItems)]
public class CharacterItemsController : CharacterBaseController
{	
	private const string IdField = "itemId";
	private ILogger _logger;
	
	public struct InputItem
	{
		public string name {get;set;}
		public string description {get;set;}
		public int amount {get;set;}
	}
	
	public CharacterItemsController(ILogger<CharacterItemsController> logger)
	{
		_logger = logger;
	}
	
	protected override bool IsNotModelExist()
	{
		var ok = !base.IsNotModelExist();
		var founded = !ok ? "Not founded" : "Founded";
		_logger.LogDebug($"Model Founding status: {founded}");
		if (ok && HttpContext.GetRouteValue(IdField) != null)
		{
			_logger.LogDebug($"'{IdField}' is founded. Try parse to id");
			var str = HttpContext.GetRouteValue(IdField)?.ToString();
			ok = int.TryParse(str, out var itemId) && Model.Items.Count > itemId;
			_logger.LogDebug($"'{IdField}': {itemId}, 'Model.Items.Count': {Model.Items.Count}, 'ok': {ok}");
		}
		return !ok;
	}
	
		
	[HttpGet]
	public ActionResult GetItems()
	{
		var builder = Model.GetDictBuilder();
		builder.WithItems(Model.Items);
		return Ok(builder.Build());
	}
	
	[HttpGet("{"+IdField+"}")]
	public ActionResult GetItem(int itemId)
	{
		if (IsNotModelExist())
			return NotFound();
		var item = Model.Items[itemId];
		return Ok(item.ToDict());
	}
	
	[HttpPut("{"+IdField+"}")]
	public ActionResult PutItem(int itemId, [FromBody, Required] InputItem input)
	{
		if (IsNotModelExist())
			return NotFound();
		var item = Model.Items[itemId];
		item.UpdateInfo(new Models.ItemInfo(){Name = input.name, Description = input.description});
		item.Amount = input.amount;
		SaveModel(Model);
		return Created(TdnUriPath.CharacterItems + $"/{itemId}", item.ToDict());
	}
	
	[HttpPost]
	public ActionResult PostItem([FromBody, Required] InputItem input)
	{
		var itemId = Model.Items.Count;
		var item = new AmountedItem(new ItemInfo(){Name = input.name, Description = input.description}, input.amount);
		Model.Items.Add(item);
		SaveModel(Model);
		return Created(TdnUriPath.CharacterItems + $"/{itemId}", item.ToDict());
	}
	
	[HttpDelete("{"+IdField+"}")]
	public ActionResult DeleteItem(int itemId)
	{
		if (IsNotModelExist())
			return NotFound();
		Model.Items.RemoveAt(itemId);
		SaveModel(Model);
		return Ok(null);
	}
}


