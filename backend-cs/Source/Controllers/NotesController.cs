using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Models;
using TdnApi.Models.Db;
using TdnApi.Security;
using TdnApi.Security.Filters;
using static TdnApi.Constants;

namespace TdnApi.Controllers;

[ApiController]
[Authorize(Policy = Policy.UserOrGroup)]
[Route(ApiPrefix+"notes")]
public class NotesController: BaseController
{
	private TdnDbContext _dbContext;
	public NotesController(TdnDbContext dbContext) 
	{
		_dbContext = dbContext;
	}
	
	[HttpGet]
	[AccessToGroup]
	public ActionResult<IEnumerable<Note>> GetNotes(
		[FromQuery]string? group_id, 
		[FromQuery]string? owner_id
	)
	{
		Note[]? notes = null;
		string groupId = group_id == null ? AccessId : group_id;
		string ownerId = owner_id == null ? AccessId : owner_id;
		if (FromAdmin() && owner_id == null)
			notes = _dbContext.Notes.Where(e => e.GroupId == groupId).ToArray();
		else if (FromUser() || owner_id != null)
			notes = _dbContext.Notes
				.Where(e => e.GroupId == groupId && e.OwnerId == ownerId).ToArray();
		if (notes == null)
			return Forbid();
		var result = new Dictionary<string, object>()
			{{"notes", notes.Select(e => GenerateNoteResponse(e))}};
		return Ok(result);
	}	
	
	[HttpPost]
	[AccessToGroup]
	[AccessToUser]
	public ActionResult<Note> PostNote(
		[FromBody] NotePostBody data,
		[FromQuery] string? group_id,
		[FromQuery] string? owner_id
	)
	{
		if (group_id == null && owner_id == null)
			return BadRequest();
		string groupId = group_id == null ? AccessId : group_id;
		string ownerId = owner_id == null ? AccessId : owner_id;	
		var note = new Note();
		note.Header = data.header;
		note.Body = data.body;
		note.GroupId = groupId;
		note.OwnerId = ownerId;
		var result = _dbContext.Notes.Add(note).Entity;
		_dbContext.SaveChanges();
		return Created(ApiPrefix+$"notes/{result.Id}", GenerateNoteResponse(result));
	}
	
	[HttpGet("{id}")]
	[AccessToGroup]
	public ActionResult<Note> GetNote([FromRoute]int id, [FromQuery]string? group_id)
	{
		string groupId = group_id == null ? AccessId : group_id;
		Note? note = FindNote(id, groupId);
		if (note == null)
			return NotFound();
		return Ok(GenerateNoteResponse(note));
	}
	
	[HttpPut("{id}")]
	[AccessToGroup]
	public ActionResult PutNote(
		[FromBody]NotePutBody data,
		[FromRoute]int id, 
		[FromQuery]string? group_id)
	{
		string groupId = group_id == null ? AccessId : group_id;
		Note? note = FindNote(id, groupId);
		if (note == null)
			return NotFound();
		if (data.body != null)
			note.Body = data.body;
		if (data.header != null)
			note.Header = data.header;
		_dbContext.Update(note);
		_dbContext.SaveChanges();
		return Ok();
	}
	
	[HttpDelete("{id}")]
	[AccessToGroup]
	public ActionResult DelNote([FromRoute]int id, [FromQuery]string? group_id)
	{
		string groupId = group_id == null ? AccessId : group_id;
		Note? note = FindNote(id, groupId);
		if (note == null)
			return NotFound();
		_dbContext.Remove(note);
		_dbContext.SaveChanges();
		return Ok();
	}
	
	private Note? FindNote(int id, string group_id)
	{
		Note? note = null;
		if (FromAdmin())
			note = _dbContext.Notes
				.Where(e => e.Id == id && e.GroupId == group_id).FirstOrDefault();
		else if (FromUser())
			note = _dbContext.Notes
				.Where(e => e.Id == id && e.GroupId == group_id && e.OwnerId == AccessId)
				.FirstOrDefault();
		return note;
	}
	
	private Dictionary<string, object> GenerateNoteResponse(Note note)
	{
		Dictionary<string, object> result = new()
		{
			{"group_id", note.GroupId},
			{"owner_id", note.OwnerId},
			{"id", note.Id},
			{"header", note.Header},
			{"body", note.Body},
			{"last_modify", note.ModifiedDate},
		};
		if (note.Owner != null)
			result.Add("author", new Dictionary<string, string?>()
				{
					{"id", note.Owner.Id},
					{"first_name", note.Owner.FirstName},
					{"last_name", note.Owner.LastName},
					{"photo", note.Owner.PhotoLink}
				}
			);
		return result;
	}
	
	public record NotePostBody(string header, string body);
	public record NotePutBody(string? header, string? body);
}