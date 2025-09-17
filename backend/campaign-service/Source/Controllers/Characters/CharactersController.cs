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
    }
    
    public struct FieldPatchData
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public int? Value { get; set; }
        public int? MaxValue { get; set; }
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
    public ActionResult PostCharacter(int groupId, [FromBody] CharacterPostData data, [FromQuery] bool copyTemplate = false)
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
                Description = data.Description
            };
            if (copyTemplate)
                character.Fields = charlist.Fields;
            var characterData = new CharacterData(){ GroupId = groupId, TemplateId = (int)data.TemplateId };
            GetCollection().InsertOne(character);
            characterData.UUID = character.Id.ToString();
            DbContext.Set<CharacterData>().Add(characterData);
            DbContext.SaveChanges();
            return Created($"/groups/{groupId}/characters/{characterData.Id}", characterData.ToDict(character));
        }
        return NotFound("Group not found");
    }

    private CharacterMongoData CompareCharacterWithTemplate(CharacterMongoData character, CharlistMongoData charlist)
    {
        var result = character;
        foreach (var field in charlist.Fields)
        {
            if (result.Fields.ContainsKey(field.Key))
            {
                var charField = result.Fields[field.Key];
                charField.Name = field.Value.Name;
                charField.Description = field.Value.Description;
                result.Fields[field.Key] = charField;
            }
            else
            {
                result.Fields.Add(field.Key, field.Value);
            }
        }
        result.Schema = charlist.Schema;
        return result;
    }

    private CharacterMongoData AsCharacterWithTemplate(CharacterData data, CharacterMongoData character)
    {
        var charlistSet = DbContext.Set<CharlistData>();
        var charlistData = charlistSet.Where(e => e.GroupId == data.GroupId && e.Id == data.TemplateId).FirstOrDefault();
        if (charlistData == null)
            return character;
        var charlist = Mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, charlistData.UUID);
        if (charlist == null)
            return character;
        return CompareCharacterWithTemplate(character, charlist);
    }

    [HttpGet("{characterId}")]
    public ActionResult GetCharacter(int groupId, int characterId, [FromQuery] bool witEmptyFields = true)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            if (witEmptyFields)
                character = AsCharacterWithTemplate(data, character);
            return Ok(data.ToDict(character));
        }
        return NotFound("Character or Group not found");
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
    
    private bool TryChangeFields(CharacterMongoData character, CharlistMongoData template, CharacterPatchData data, out List<string> errors)
    {
        var doSomething = false;
        errors = new();
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
                    if (value.Name == null && value.Description == null && value.Value == null && value.Category == null && value.MaxValue == null) 
                        continue;
                    FieldMongoData existField = character.Fields[field.Key];
                    if (value.MaxValue != null && existField is PropertyMongoData)
                        ((PropertyMongoData)existField).MaxValue = (int)value.MaxValue;
                    existField.Name = value.Name != null ? value.Name : existField.Name;
                    existField.Description = value.Description != null ? value.Description : existField.Description;
                    existField.Value = value.Value != null ? (int)value.Value : existField.Value;
                    existField.Category = value.Category != null ? value.Category : existField.Category;
                    doSomething = true;
                }
            }
            else
            {
                if (tmp == null)
                {
                    errors.Add($"Can't delete field with key '{field.Key}': this field does not exist or set as default");
                    continue;
                }
                var value = (FieldPatchData)tmp;
                var isDefaultField = template.Fields.ContainsKey(field.Key);
                if (isDefaultField)
                {
                    var newField = template.Fields[field.Key];
                    if (value.MaxValue != null && newField is PropertyMongoData)
                        ((PropertyMongoData)newField).MaxValue = (int)value.MaxValue;
                    newField.Value = value.Value != null ? (int)value.Value : newField.Value;
                    character.Fields.Add(field.Key, newField);
                }
                else
                {
                    if (value.Name == null || value.Description == null)
                    {
                        errors.Add($"Can't create field with key '{field.Key}': name and description must be not null");
                        continue;
                    }
                    var newField = value.MaxValue == null ? 
                        new FieldMongoData():
                        new PropertyMongoData() { MaxValue = value.MaxValue != null ? (int)value.MaxValue : 0 };
                    if (value.Category != null)
                        newField.Category = value.Category;
                    newField.Name = value.Name == null ? "" : value.Name;
                    newField.Description = value.Description == null ? "" : value.Description;
                    newField.Value = value.Value != null ? (int)value.Value : 0;
                    character.Fields.Add(field.Key, newField);
                }
                doSomething = true;
            }
        }
        return doSomething;
    }
          
    [HttpPatch("{characterId}")]
    public ActionResult PatchCharacter(int groupId, int characterId, CharacterPatchData data, [FromQuery] bool witEmptyFields = true)
    {
        if (TryGetCharacter(groupId, characterId, out var characterData, out var character))
        {
            var anythingChanged = false;
            anythingChanged = anythingChanged || TryChangeProperties(character, data);
            var charlistSet = DbContext.Set<CharlistData>();
            var charlistData = charlistSet.Where(e => e.GroupId == groupId && e.Id == characterData.TemplateId).FirstOrDefault();
            if (charlistData == null)
                return NotFound("Template not found");
            var charlist = Mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, charlistData.UUID);
            if (charlist == null)
                return NotFound("Template document not found");
            var fieldsChanged = TryChangeFields(character, charlist, data, out var errors);
            anythingChanged = (anythingChanged && data.Fields == null) || fieldsChanged;
            if (anythingChanged)
            {
                var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
                GetCollection().ReplaceOne(filter, character);
                DbContext.SaveChanges();
                if (witEmptyFields)
                    character = AsCharacterWithTemplate(characterData, character);
                var result = characterData.ToDict(character);
                if (errors.Count > 0)
                    result.Add("errors", errors);
                return Ok(result);
            }
            else if (errors.Count > 0)
                return BadRequest(new { errors = errors });
            else
                return BadRequest("Nothing to do");
        }
        return NotFound("Character or Group not found");
    }
    
    [HttpDelete("{characterId}")]
    public ActionResult DeleteCharacter(int groupId, int characterId, [FromQuery] bool witEmptyFields = true)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            DbContext.Remove(data);
            DbContext.SaveChanges();
            GetCollection().DeleteOne(filter);
            if (witEmptyFields)
                character = AsCharacterWithTemplate(data, character);
            return Ok(data.ToDict(character));
        }
        return NotFound("Character or Group not found");
    }
}