using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Api.Paths;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Authorize(Policy.AccessLevel.Follower)]
[Route(TdnUriPath.CharacterNotes)]
public class CharacterNotesController : CharacterBaseController
{
	public struct NoteData
	{
		public string header;
		public string body;
	}
	
	[HttpGet]
	public ActionResult GetNotes()
	{
		var builder = Model.GetDictBuilder();
		builder.WithNotes(Model.Notes);
		return Ok(builder.Build());
	}
	
	private ActionResult IfNoteExist(int noteId, Func<Note, ActionResult> action)
	{
		if (Model.Notes.Count < noteId)
			return NotFound();
		return action(Model.Notes[noteId]);
	}
	
	[HttpGet("{noteId}")]
	public ActionResult GetNote(int noteId) => IfNoteExist(noteId, (Note note) => 
	{
		return Ok(note.ToDict());
	});
	
	[Authorize(Policy.AccessLevel.Moderator)]
	[HttpPut("{noteId}")]
	public ActionResult PutNote(int noteId, [FromBody, Required] NoteData newData) => IfNoteExist(noteId, (Note note) =>
	{
		note.Header = newData.header;
		note.Body = newData.body;
		return Created(TdnUriPath.CharacterNotes + $"/{noteId}", note.ToDict());
	});	
}


