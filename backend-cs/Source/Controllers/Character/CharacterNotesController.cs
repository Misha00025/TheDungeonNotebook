using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Authorize(Policy.AccessLevel.Follower)]
[Route(TdnUriPath.CharacterNotes)]
public class CharacterNotesController : CharacterBaseController
{		
	[HttpGet]
	public ActionResult GetNotes()
	{
		var builder = Model.GetDictBuilder();
		builder.WithNotes(Model.Notes);
		return Ok(builder.Build());
	}	
}


