using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Route("character")]
public class CharacterController : BaseController<CharacterContext>
{
    public CharacterController(CharacterContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
    {
    }

    [HttpGet]
	public ActionResult GetInfo()
	{
		return Ok();
	}
	
	[HttpDelete]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteCharacter(bool debug = false)
	{
		if (debug)
		{
			Console.WriteLine("\n\n-------------------------\nDebug!\n-------------------------\n\n");
			return Ok();		
		}
		return Ok();
	}
	
	[HttpGet("notes")]
	public ActionResult GetNotes()
	{
		return Ok();
	}
	
	[HttpPost("notes")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddNote()
	{
		return Created("","");
	}
	
	[HttpGet("inventories")]
	public ActionResult GetInventories()
	{
		return Ok();
	}
	
	[HttpPost("inventories")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddInventory()
	{
		return Created("", "");
	}
	
	[HttpGet("owners")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult GetOwners()
	{
		return Ok();
	}
	
	[HttpPost("owners")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult AddOwner([Required]int owner_id, int access_level = 0)
	{
		return Ok();
	}
	
	[HttpDelete("owners")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteOwner([Required]int owner_id)
	{
		return Ok();
	}
}