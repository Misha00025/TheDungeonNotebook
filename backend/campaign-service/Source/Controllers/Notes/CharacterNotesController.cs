using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Providing;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/characters/{characterId}/notes")]
public class CharacterNotesController : BaseController
{
    private NotesProvider _provider;

    public CharacterNotesController(NotesProvider provider)
    {
        _provider = provider;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId, int characterId)
    {
        var notes = _provider.GetCharacterNotes(groupId, characterId);
        return Ok(notes.Select(n => n.ToResponse()));
    }

    [HttpPost]
    public ActionResult PostNote(int groupId, int characterId, [FromBody] NotePostData data)
    {
        if (string.IsNullOrEmpty(data.Header))
            return BadRequest(new { error = "Header is required" });

        if (!_provider.TryCreateCharacterNote(groupId, characterId, data.Header, data.ShortDescription, data.Body, out var note))
            return BadRequest(new { error = "Failed to create note" });

        return Created($"/groups/{groupId}/characters/{characterId}/notes/{note!.Id}", note.ToResponse());
    }

    [HttpGet("{noteId}")]
    public ActionResult GetNote(int groupId, int characterId, int noteId)
    {
        var note = _provider.GetCharacterNote(groupId, characterId, noteId);
        if (note == null)
            return NotFound();
        return Ok(note.ToResponse());
    }

    [HttpPut("{noteId}")]
    public ActionResult PutNote(int groupId, int characterId, int noteId, [FromBody] NotePostData data)
    {
        if (!_provider.TryUpdateCharacterNote(groupId, characterId, noteId, data.Header, data.ShortDescription, data.Body, out var note))
        {
            if (note == null)
                return NotFound();
            return BadRequest(new { error = "Failed to update note" });
        }
        return Ok(note!.ToResponse());
    }

    [HttpDelete("{noteId}")]
    public ActionResult DeleteNote(int groupId, int characterId, int noteId)
    {
        if (!_provider.TryDeleteCharacterNote(groupId, characterId, noteId))
            return NotFound();
        return Ok();
    }
}
