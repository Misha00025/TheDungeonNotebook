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
        return Ok(result);
    }
    
    [HttpPost]
    public ActionResult PostNote(int groupId, int characterId, [FromBody] NotePostData data)
    {
        return NotImplemented();
    }
        
    [HttpGet("{noteId}")]
    public ActionResult GetNote(int groupId, int characterId, int noteId)
    {
        return NotImplemented();
    }
    
    [HttpPut("{noteId}")]
    public ActionResult PutNote(int groupId, int characterId, int noteId, NotePostData data)
    {
        return NotImplemented();
    }
    
    [HttpDelete("{noteId}")]
    public ActionResult DeleteNote(int groupId, int characterId, int noteId)
    {
        return NotImplemented();
    }
}