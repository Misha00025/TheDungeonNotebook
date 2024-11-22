using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Route("characters/{character_id}")]
public class CharacterController : BaseController<CharacterContext>
{
	public CharacterController(CharacterContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
	}

	private int CharacterId 
	{
		get
		{
			return _container.ResourceInfo[Resource.Character].Id;
		}
	}

	[HttpGet]
	public ActionResult GetInfo()
	{
		var character = _dbContext.Characters.Where(e => e.Id == CharacterId).FirstOrDefault();
		if (character == null)
			return NotFound();
		return Ok(new Dictionary<string, object>()
		{
			{"id", character.Id},
			{"name", character.Name},
			{"description", character.Description},
			{"group_id", character.GroupId},
		});
	}
	
	[HttpDelete]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteCharacter()
	{
		if (IsDebug())
			return Ok();		
		return Ok();
	}
	
	[HttpGet("owners")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult GetOwners()
	{
		return Ok();
	}
	
	[HttpPost("owners/{owner_id}")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult AddOwner(int owner_id, int access_level = 0)
	{
		return Ok();
	}
	
	[HttpDelete("owners/{owner_id}")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteOwner(int owner_id)
	{
		if (IsDebug())
			return Ok();
		return Ok();
	}
}