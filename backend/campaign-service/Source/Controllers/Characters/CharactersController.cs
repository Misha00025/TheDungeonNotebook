using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters")]
public class CharactersController : CharactersBaseController
{
    public struct CharacterPostData
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public int? TemplateId { get; set; }
        public int? OwnerId { get; set; }
    }
    
    public struct FieldPatchData
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int? Value { get; set; }
    }
    
    public struct CharacterPatchData
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int? OwnerId { get; set; }
        public Dictionary<string, FieldPatchData?>? Fields { get; set; }
    }

    public CharactersController(EntityContext context, MongoDbContext mongo, GroupContext groupContext) : base(context, mongo, groupContext)
    {
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int? ownerId = null)
    {
        var characters = GetCharacters(groupId);
        if (characters == null)
            return NotFound("Group not found");
        if (ownerId != null)
            characters = characters.Where(e => e.metadata.OwnerId! == ownerId!).ToList();
        return Ok(characters.Select(e => e.metadata.ToDict(e.character)));
    }
    
    [HttpPost]
    public ActionResult PostCharacter(int groupId, [FromBody] CharacterPostData data)
    {
        if (data.TemplateId == null)
            return BadRequest("TemplateId must be not null");
        if (TryGetGroup(groupId, out var _))
        {
            var charlistSet = DbContext.Set<CharlistData>();
            var charlistData = charlistSet.Where(e => e.GroupId == groupId && e.Id == data.TemplateId).FirstOrDefault();
            if (charlistData == null)
                return NotFound("Template not found");
            var charlist = Mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, charlistData.UUID);
            if (charlist == null)
                return NotFound("Template document not found");
            var character = new CharacterMongoData()
            {
                Name = data.Name,
                Description = data.Description,
                Fields = charlist.Fields
            };
            var characterData = new CharacterData(){ GroupId = groupId, OwnerId = data.OwnerId, TemplateId = (int)data.TemplateId };
            GetCollection().InsertOne(character);
            characterData.UUID = character.Id.ToString();
            DbContext.Set<CharacterData>().Add(characterData);
            DbContext.SaveChanges();
            return Created($"/groups/{groupId}/characters/{characterData.Id}", characterData.ToDict(character));
        }
        return NotFound("Group not found");
    }
    
    [HttpGet("{characterId}")]
    public ActionResult GetCharacter(int groupId, int characterId)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
            return Ok(data.ToDict(character));
        return NotFound("Character or Group not found");
    }
    
    private bool TryChangeOwnerId(CharacterData cd, CharacterPatchData data)
    {
        var ok = data.OwnerId != null;
        if (data.OwnerId == -1)
            data.OwnerId = null;
        cd.OwnerId = data.OwnerId;
        return ok;
    }
    
    private bool TryChangeProperties(CharacterMongoData character, CharacterPatchData data)
    {
        var ok = data.Name != null || data.Description != null;
        if (data.Name != null)
            character.Name = data.Name;
        if (data.Description != null)
            character.Description = data.Description;
        return ok;
    } 
    
    private bool TryChangeFields(CharacterMongoData character, CharacterPatchData data)
    {
        var allFieldsCorrect = true;
        if (data.Fields == null || data.Fields.Count == 0)
            return false;
        foreach (var field in data.Fields)
        {
            var tmp = field.Value;
            var isExist = character.Fields.ContainsKey(field.Key);
            if (isExist)
            {
                if (tmp == null)
                {
                    character.Fields.Remove(field.Key);
                }
                else
                {   
                    var value = (FieldPatchData)tmp;
                    if (value.Name == null && value.Description == null && value.Value == null) 
                        return false;
                    var existField = character.Fields[field.Key];
                    existField.Name = value.Name != null ? value.Name : existField.Name;
                    existField.Description = value.Description != null ? value.Description : existField.Description;
                    existField.Value = value.Value != null ? (int)value.Value : existField.Value;
                }
            }
            else
            {
                if (tmp == null)
                    return false;
                var value = (FieldPatchData)tmp;
                if (value.Name == null || value.Description == null)
                    return false;
                var newField = new FieldMongoData()
                {
                    Name = value.Name!,
                    Description = value.Description!,
                    Value = value.Value != null ? (int)value.Value : 0
                };
                character.Fields.Add(field.Key, newField);
            }
        }
        return allFieldsCorrect;
    }
          
    [HttpPatch("{characterId}")]
    public ActionResult PatchCharacter(int groupId, int characterId, CharacterPatchData data)
    {
        if (TryGetCharacter(groupId, characterId, out var characterData, out var character))
        {
            var anythingChanged = TryChangeOwnerId(characterData, data);
            anythingChanged = anythingChanged || TryChangeProperties(character, data);
            anythingChanged = (anythingChanged && data.Fields == null) || TryChangeFields(character, data);
            if (anythingChanged)
            {
                var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
                GetCollection().ReplaceOne(filter, character);
                DbContext.SaveChanges();
                return Ok(characterData.ToDict(character));
            }
            return BadRequest("Nothing to do");
        }
        return NotFound("Character or Group not found");
    }
    
    [HttpDelete("{characterId}")]
    public ActionResult DeleteCharacter(int groupId, int characterId)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            DbContext.Remove(data);
            DbContext.SaveChanges();
            GetCollection().DeleteOne(filter);
            return Ok(data.ToDict(character));
        }
        return NotFound("Character or Group not found");
    }
}