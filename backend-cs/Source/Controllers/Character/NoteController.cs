using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Route("characters/{character_id}/notes")]
public class NoteController : BaseController<NoteContext>
{
	public NoteController(NoteContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
	}
	
	[HttpGet]
	public ActionResult GetNotes(int character_id)
	{
		return Ok();
	}
	
	[HttpPost]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddNote()
	{
		return Created("","");
	}
	
	[HttpGet("{note_id:int}")]
	public ActionResult GetInfo(int character_id, int id)
	{
		return Ok();
	}
	
	[HttpPut("{note_id:int}")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult UpdateInfo(int character_id, int id)
	{
		return Ok();
	}
	
	[HttpDelete("{note_id:int}")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult Delete(int character_id, int id)
	{
		return Ok();
	}
}