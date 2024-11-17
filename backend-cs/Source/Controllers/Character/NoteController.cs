using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Route("character/note")]
public class NoteController : BaseController<NoteContext>
{
	public NoteController(NoteContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
	}
	
	[HttpGet("{id:int}")]
	public ActionResult GetInfo([Required][FromRoute]int id)
	{
		return Ok();
	}
	
	[HttpPut("{id:int}")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult UpdateInfo([Required][FromRoute]int id)
	{
		return Ok();
	}
	
	[HttpDelete("{id:int}")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult Delete([Required][FromRoute]int id)
	{
		return Ok();
	}
}