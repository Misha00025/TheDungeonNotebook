using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Namotion.Reflection;
using Tdn.Api.Paths;
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
	private readonly ILogger<CharacterNotesController> _logger;

	public struct NoteData
	{
		public string header { get; set; }
		public string body { get; set; }
	}
	
	protected override bool IsNotModelExist()
	{
		var ok = !base.IsNotModelExist();
		var founded = !ok ? "Not founded" : "Founded";
		_logger.LogDebug($"Model Founding status: {founded}");
		if (ok && HttpContext.GetRouteValue("noteId") != null)
		{
			_logger.LogDebug($"'noteId' is founded. Try parse to id");
			var str = HttpContext.GetRouteValue("noteId")?.ToString();
			ok = int.TryParse(str, out var noteId) && Model.Notes.Count > noteId;
			_logger.LogDebug($"'noteId': {noteId}, 'Model.Notes.Count': {Model.Notes.Count}, 'ok': {ok}");
		}
		return !ok;
	}
	
	public CharacterNotesController(ILogger<CharacterNotesController> logger)
	{
		_logger = logger;
	}
	
	[HttpGet]
	public ActionResult GetNotes()
	{
		var builder = Model.GetDictBuilder();
		builder.WithNotes(Model.Notes);
		return Ok(builder.Build());
	}
	
	[HttpGet("{noteId}")]
	public ActionResult GetNote(int noteId)
	{
		if (IsNotModelExist())
			return NotFound();
		var note = Model.Notes[noteId];
		return Ok(note.ToDict());
	}
	
	[Authorize(Policy.AccessLevel.Moderator)]
	[HttpPut("{noteId}")]
	public ActionResult PutNote(int noteId, [FromBody, Required] NoteData newData)
	{
		if (IsNotModelExist())
			return NotFound();
		var note = Model.Notes[noteId];
		note.Header = newData.header;
		note.Body = newData.body;
		note.ModifyDate = DateTime.Now;
		SaveModel(Model);
		return Created(TdnUriPath.CharacterNotes + $"/{noteId}", note.ToDict());
	}	
	
	[Authorize(Policy.AccessLevel.Moderator)]
	[HttpPost]
	public ActionResult PostNote([FromBody, Required] NoteData newData)
	{
		if (IsNotModelExist())
			return NotFound();
		var noteId = Model.Notes.Count;
		var note = new Note()
		{
			Header = newData.header,
			Body = newData.body,
			AdditionDate = DateTime.Now,
			ModifyDate = DateTime.Now
		};
		Model.Notes.Add(note);
		SaveModel(Model);
		return Created(TdnUriPath.CharacterNotes + $"/{noteId}", note.ToDict());
	}
	
	[Authorize(Policy.AccessLevel.Moderator)]
	[HttpDelete("{noteId}")]
	public ActionResult DeleteNote(int noteId)
	{
		if (IsNotModelExist())
			return NotFound();
		Model.Notes.RemoveAt(noteId);
		SaveModel(Model);
		return Ok(null);
	}
}


