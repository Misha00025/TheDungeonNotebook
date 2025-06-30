using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/characters/{characterId}/notes")]
public class CharacterNotesController : CharactersBaseController
{
    public struct NotePostData
    {
        public string Header { get; set; }
        public string Body { get; set; }
    }

    public CharacterNotesController(EntityContext context, MongoDbContext mongo, GroupContext groupContext) : base(context, mongo, groupContext)
    {
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int characterId)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            return Ok(character.Notes.ToDict());
        }
        return NotFound("Group or Character not found");
    }
    [HttpPost]
    public ActionResult PostNote(int groupId, int characterId, [FromBody] NotePostData data)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            var noteId = character.Notes.Count;
            var note = new NoteMongoData()
            {
                Header = data.Header,
                Body = data.Body,
                AdditionDate = DateTime.Now,
                ModifyDate = DateTime.Now
            };
            character.Notes.Add(note);
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            GetCollection().ReplaceOne(filter, character);
            return Created($"/groups/{groupId}/characters/{characterId}/notes/{noteId}", character.Notes[noteId].ToDict(noteId));
        }
        return NotFound("Group or Character not found");
    }
        
    [HttpGet("{noteId}")]
    public ActionResult GetNote(int groupId, int characterId, int noteId)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            if (character.Notes.Count <= noteId)
                return NotFound();
            return Ok(character.Notes[noteId].ToDict(noteId));
        }
        return NotFound("Group or Character not found");
    }
    
    [HttpPut("{noteId}")]
    public ActionResult PutNote(int groupId, int characterId, int noteId, NotePostData data)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            if (character.Notes.Count <= noteId)
                return NotFound();
            character.Notes[noteId].Header = data.Header;
            character.Notes[noteId].Body = data.Body;
            character.Notes[noteId].ModifyDate = DateTime.Now;
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            GetCollection().ReplaceOne(filter, character);
            return Ok(character.Notes[noteId].ToDict(noteId));
        }
        return NotFound("Group or Character not found");
    }
    
    [HttpDelete("{noteId}")]
    public ActionResult DeleteNote(int groupId, int characterId, int noteId)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            if (character.Notes.Count <= noteId)
                return NotFound();
            var note = character.Notes[noteId];
            character.Notes.RemoveAt(noteId);
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            GetCollection().ReplaceOne(filter, character);
            return Ok(note.ToDict(noteId));
        }
        return NotFound("Group or Character not found");
    }
}