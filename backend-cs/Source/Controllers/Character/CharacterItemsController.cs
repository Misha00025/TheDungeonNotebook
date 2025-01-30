using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Authorize(Policy.AccessLevel.Follower)]
[Route(TdnUriPath.CharacterItems)]
public class CharacterItemsController : CharacterBaseController
{		
	[HttpGet]
	public ActionResult GetItems()
	{
		var builder = Model.GetDictBuilder();
		builder.WithItems(Model.Items);
		return Ok(builder.Build());
	}	
}


