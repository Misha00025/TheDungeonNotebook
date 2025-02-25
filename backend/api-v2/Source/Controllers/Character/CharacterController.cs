using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Authorize(Policy.AccessLevel.Follower)]
[Route(TdnUriPath.Character)]
public class CharacterController : CharacterBaseController
{		
	[HttpGet]
	public ActionResult GetInfo(bool with_notes = false, bool with_items = false)
	{
		var builder = Model.GetDictBuilder();
		if (with_items)
			builder.WithItems(Model.Items);
		if (with_notes)
			builder.WithNotes(Model.Notes);
		return Ok(builder.Build());
	}	
}