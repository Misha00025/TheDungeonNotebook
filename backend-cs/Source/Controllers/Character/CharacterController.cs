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
[Route(TdnUriPath.Character)]
public class CharacterController : BaseController<Character>
{
	private int CharacterId => Container.ResourceInfo[Resource.Character].Id;
	protected override string GetUUID() => CharacterId.ToString();
		
	[HttpGet]
	public ActionResult GetInfo(bool with_notes = true, bool with_items = true)
	{
		var builder = Model.GetDictBuilder();
		if (with_items)
			builder.WithItems(Model.Items);
		if (with_notes)
			builder.WithNotes(Model.Notes);
		return Ok(builder.Build());
	}	
}