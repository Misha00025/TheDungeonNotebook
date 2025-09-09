using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/notes")]
public class GroupNotesController : BaseController<GroupNoteData>
{
    public GroupNotesController(MongoDbContext mongo) : base(mongo)
    {
    }

    protected override string CollectionName => "group_notes";
    
    
    [HttpGet]
    public ActionResult GetAll(int groupId)
    {
        var filter = Builders<GroupNoteData>.Filter.Eq(n => n.GroupId, groupId);
        var result = Collection.Find(filter).ToList();
        return Ok(result.AsResult());
    }
    
    [HttpPost]
    public ActionResult PostNote(int groupId, [FromBody] NotePostData data)
    {
        var noteData = new GroupNoteData(){
            GroupId = groupId,
            Header = data.Header,
            Body = data.Body,
            AdditionDate = DateTime.UtcNow,
            ModifyDate = DateTime.UtcNow
        };
        noteData.NoteId = IdGenerator.GetNextNoteIdForGroup(noteData.GroupId);
        Collection.InsertOne(noteData);
        return Created($"/groups/{groupId}/notes/{noteData.NoteId}", noteData.AsResult());
    }
        
    [HttpGet("{noteId}")]
    public ActionResult GetNote(int groupId, int noteId)
    {
        var filter = Builders<GroupNoteData>.Filter.Eq(n => n.GroupId, groupId) & 
                    Builders<GroupNoteData>.Filter.Eq(n => n.NoteId, noteId);
        var note = Collection.Find<GroupNoteData>(filter).FirstOrDefault();
        if (note == null)
            return NotFound();
        return Ok(note.AsResult());
    }
    
    [HttpPut("{noteId}")]
    public ActionResult PutNote(int groupId, int noteId, NotePostData data)
    {
        var filter = Builders<GroupNoteData>.Filter.Eq(n => n.GroupId, groupId) & 
                    Builders<GroupNoteData>.Filter.Eq(n => n.NoteId, noteId);
        var update = Builders<GroupNoteData>.Update
            .Set(n => n.Header, data.Header)
            .Set(n => n.Body, data.Body)
            .Set(n => n.ModifyDate, DateTime.UtcNow);
        var options = new FindOneAndUpdateOptions<GroupNoteData>
        {
            IsUpsert = true,
            ReturnDocument = ReturnDocument.After
        };
        var note = Collection.FindOneAndUpdate<GroupNoteData>(filter, update, options);
        if (note == null)
            return NotFound();
        return Ok(note.AsResult());
    }
    
    [HttpDelete("{noteId}")]
    public ActionResult DeleteNote(int groupId, int noteId)
    {
        var filter = Builders<GroupNoteData>.Filter.Eq(n => n.GroupId, groupId) & 
                    Builders<GroupNoteData>.Filter.Eq(n => n.NoteId, noteId);
        var result = Collection.DeleteOne(filter);
        if (result.DeletedCount > 0)
            return Ok();
        return NotFound();
    }
}