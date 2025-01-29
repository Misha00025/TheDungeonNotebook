using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Authorize(Policy.AccessLevel.Follower)]
[Route("characters/"+"{"+Fields.CharacterID+"}")]
public class CharacterController : BaseController<Character>
{
	private int CharacterId => Container.ResourceInfo[Resource.Character].Id;
	protected override string GetUUID() => CharacterId.ToString();
		
	[HttpGet]
	public ActionResult GetInfo(bool withNotes = false, bool withItems = false)
	{
		return Ok(Model.ToDict());
	}	
}