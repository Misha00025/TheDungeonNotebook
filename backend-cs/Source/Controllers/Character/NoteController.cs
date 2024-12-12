using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Models.Inputs;
using TdnApi.Db.Contexts;
using TdnApi.Db.Convertors;
using TdnApi.Db.Entities;
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
	
	private HttpResourceInfo Info => _container.ResourceInfo[Resource.Character];
	
	[HttpGet]
	public ActionResult GetNotes()
	{
		var notes = _dbContext.Notes.Where(e => e.OwnerId == Info.Id);
		return Ok(notes.ManyConversions(e => e.ToDict()));
	}
	
	[HttpPost]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddNote([Required][FromBody] InputNote noteInput)
	{
		if (noteInput.header == null || noteInput.body == null)
			return BadRequest();
		var last = _dbContext.Notes.Where(e => e.OwnerId == Info.Id).OrderBy(e => e.Id).LastOrDefault();
		int maxId = last == null ? 1 : last.Id;
		var note = new NoteData(){Id = maxId + 1, Header = noteInput.header, Body = noteInput.body, OwnerId = Info.Id};
		if (IsDebug())
			return Created("","");
		
		_dbContext.Add(note);
		_dbContext.SaveChanges();
		return Created("","");
	}
	
	[HttpGet("{note_id:int}")]
	public ActionResult GetInfo(int note_id)
	{
		var note = _dbContext.Notes.Where(e => e.OwnerId == Info.Id && e.Id == note_id).FirstOrDefault();
		if (note == null)
			return NotFound();
		return Ok(note.ToDict());
	}
	
	[HttpPut("{note_id:int}")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult UpdateInfo(int note_id, InputNote noteInput)
	{
		if (noteInput.header == null && noteInput.body == null)
			return BadRequest();
		var note = _dbContext.Notes.Where(e => e.Id == note_id && e.OwnerId == Info.Id).FirstOrDefault();
		if (note == null)
			return NotFound();
		if (IsDebug())
			return Ok();
		if (noteInput.header != null)
			note.Header = noteInput.header;
		if (noteInput.body != null)
			note.Body = noteInput.body;
		_dbContext.Notes.Update(note);
		_dbContext.SaveChanges();
		return Ok(note.ToDict());
	}
	
	[HttpDelete("{note_id:int}")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult Delete(int character_id, int id)
	{
		if (IsDebug())
			return Ok();
		return Ok();
	}
}