using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/characters/{characterId}/notes")]
public class CharacterNotesController : BaseController<CharacterNoteData>
{
    protected override string CollectionName => "character_notes";


    public CharacterNotesController(MongoDbContext mongo) : base(mongo)
    {
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int characterId)
    {
        var filter = Builders<CharacterNoteData>.Filter.Eq(n => n.GroupId, groupId) & 
                    Builders<CharacterNoteData>.Filter.Eq(n => n.CharacterId, characterId);
        var result = Collection.Find(filter).ToList();
        return Ok(result.AsResult());
    }
    
    [HttpPost]
    public ActionResult PostNote(int groupId, int characterId, [FromBody] NotePostData data)
    {
        var noteData = new CharacterNoteData(){
            CharacterId = characterId,
            GroupId = groupId,
            Header = data.Header,
            Body = data.Body,
            AdditionDate = DateTime.UtcNow,
            ModifyDate = DateTime.UtcNow
        };
        noteData.NoteId = IdGenerator.GetNextNoteIdForGroup(noteData.GroupId);
        Collection.InsertOne(noteData);
        return Created($"/groups/{groupId}/characters/{characterId}/notes/{noteData.NoteId}", noteData.AsResult());
    }
        
    [HttpGet("{noteId}")]
    public ActionResult GetNote(int groupId, int characterId, int noteId)
    {
        var filter = Builders<CharacterNoteData>.Filter.Eq(n => n.GroupId, groupId) & 
                    Builders<CharacterNoteData>.Filter.Eq(n => n.CharacterId, characterId) &
                    Builders<CharacterNoteData>.Filter.Eq(n => n.NoteId, noteId);
        var note = Collection.Find<CharacterNoteData>(filter).FirstOrDefault();
        if (note == null)
            return NotFound();
        return Ok(note.AsResult());
    }
    
    [HttpPut("{noteId}")]
    public ActionResult PutNote(int groupId, int characterId, int noteId, NotePostData data)
    {
        var filter = Builders<CharacterNoteData>.Filter.Eq(n => n.GroupId, groupId) & 
                    Builders<CharacterNoteData>.Filter.Eq(n => n.CharacterId, characterId) &
                    Builders<CharacterNoteData>.Filter.Eq(n => n.NoteId, noteId);
        var update = Builders<CharacterNoteData>.Update
            .Set(n => n.Header, data.Header)
            .Set(n => n.Body, data.Body)
            .Set(n => n.ModifyDate, DateTime.UtcNow);
        var options = new FindOneAndUpdateOptions<CharacterNoteData>
        {
            IsUpsert = true,
            ReturnDocument = ReturnDocument.After
        };
        var note = Collection.FindOneAndUpdate<CharacterNoteData>(filter, update, options);
        if (note == null)
            return NotFound();
        return Ok(note.AsResult());
    }
    
    [HttpDelete("{noteId}")]
    public ActionResult DeleteNote(int groupId, int characterId, int noteId)
    {
        var filter = Builders<CharacterNoteData>.Filter.Eq(n => n.GroupId, groupId) & 
                    Builders<CharacterNoteData>.Filter.Eq(n => n.CharacterId, characterId) &
                    Builders<CharacterNoteData>.Filter.Eq(n => n.NoteId, noteId);
        var result = Collection.DeleteOne(filter);
        if (result.DeletedCount > 0)
            return Ok();
        return NotFound();
    }
}