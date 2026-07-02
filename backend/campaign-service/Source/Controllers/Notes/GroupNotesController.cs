using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Providing;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/notes")]
public class GroupNotesController : BaseController
{
    private NotesProvider _provider;

    public GroupNotesController(NotesProvider provider)
    {
        _provider = provider;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId, [FromQuery] string? userId = null)
    {
        var notes = _provider.GetGroupNotes(groupId);
        return Ok(notes.Select(n => n.ToResponse()));
    }

    [HttpPost]
    public ActionResult PostNote(int groupId, [FromBody] NotePostData data)
    {
        if (string.IsNullOrEmpty(data.Header))
            return BadRequest(new { error = "Header is required" });

        if (!_provider.TryCreateGroupNote(groupId, data.Header, data.ShortDescription, data.Body, out var note, data.Keywords))
            return BadRequest(new { error = "Failed to create note" });

        return Created($"/groups/{groupId}/notes/{note!.Id}", note.ToResponse());
    }

    [HttpGet("{noteId}")]
    public ActionResult GetNote(int groupId, int noteId)
    {
        var note = _provider.GetGroupNote(groupId, noteId);
        if (note == null)
            return NotFound();
        return Ok(note.ToResponse());
    }

    [HttpPut("{noteId}")]
    public ActionResult PutNote(int groupId, int noteId, [FromBody] NotePostData data)
    {
        if (!_provider.TryUpdateGroupNote(groupId, noteId, data.Header, data.ShortDescription, data.Body, out var note, data.Keywords))
        {
            if (note == null)
                return NotFound();
            return BadRequest(new { error = "Failed to update note" });
        }
        return Ok(note!.ToResponse());
    }

    [HttpDelete("{noteId}")]
    public ActionResult DeleteNote(int groupId, int noteId)
    {
        if (!_provider.TryDeleteGroupNote(groupId, noteId))
            return NotFound();
        return Ok();
    }

    [HttpGet("keywords")]
    public ActionResult GetKeywords(int groupId)
    {
        var keywords = _provider.GetGroupKeywords(groupId);
        return Ok(new { keywords });
    }
}
