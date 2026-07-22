using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.Processing;
using Tdn.Models.Providing;

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
        public int? Value { get; set; }
        public int? MaxValue { get; set; }
        public string? Formula { get; set; }
    }
    
    public struct CharacterPatchData
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int? OwnerId { get; set; }
        public Dictionary<string, FieldPatchData?>? Fields { get; set; }
    }

    private CharacterLogProvider _logProvider;

    public CharactersController(EntityContext context, MongoDbContext mongo, GroupContext groupContext, GroupAccessHelper accessHelper, CharacterLogProvider logProvider) : base(context, mongo, groupContext, accessHelper)
    {
        _logProvider = logProvider;
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int? ownerId = null, [FromQuery] int? userId = null)
    {
        var characters = GetCharacters(groupId);
        if (characters == null)
            return NotFound("Group not found");
        if (userId != null)
        {
            if (!AccessHelper.HasGroupAccess(groupId, userId.Value))
                return NotFound("Group not found");
            if (!AccessHelper.IsAdmin(groupId, userId.Value))
            {
                var accessibleIds = AccessHelper.GetAccessibleCharacterIds(groupId, userId.Value);
                characters = characters.Where(e => accessibleIds.Contains(e.metadata.Id)).ToList();
            }
        }
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

    private CharacterMongoData AsCharacterWithTemplate(CharacterData data, CharacterMongoData character)
    {
        var charlistSet = DbContext.Set<CharlistData>();
        var charlistData = charlistSet.Where(e => e.GroupId == data.GroupId && e.Id == data.TemplateId).FirstOrDefault();
        if (charlistData == null)
            return character;
        var charlist = Mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, charlistData.UUID);
        if (charlist == null)
            return character;
        return character.CompareWith(charlist);
    }

    [HttpGet("{characterId}")]
    public ActionResult GetCharacter(int groupId, int characterId, [FromQuery] bool witEmptyFields = true, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value))
            return NotFound("Character not found");
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            if (witEmptyFields)
                character = AsCharacterWithTemplate(data, character);
            FormulaCalculator.CalculateFields(character);
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
                    doSomething = true;
                }
                else
                {   
                    var value = (FieldPatchData)tmp;
                    if (value.Name == null && value.Description == null && value.Value == null && value.MaxValue == null && value.Formula == null) 
                        continue;
                    FieldMongoData existField = character.Fields[field.Key];
                    if (value.MaxValue != null && existField is PropertyMongoData)
                        ((PropertyMongoData)existField).MaxValue = (int)value.MaxValue;
                    existField.Name = value.Name != null ? value.Name : existField.Name;
                    existField.Description = value.Description != null ? value.Description : existField.Description;
                    existField.Value = value.Value != null ? (int)value.Value : existField.Value;
                    existField.Formula = value.Formula != null ? value.Formula : existField.Formula;
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
                    newField.Formula = value.Formula != null ? value.Formula : newField.Formula;
                    character.Fields.Add(field.Key, newField);
                }
                else
                {
                    errors.Add($"Can't create field with key '{field.Key}': name and description must be not null");
                    continue;
                }
                doSomething = true;
            }
        }
        return doSomething;
    }
          
    [HttpGet("{characterId}/log")]
    public ActionResult GetCharacterLog(int groupId, int characterId, [FromQuery] int limit = 50, [FromQuery] int offset = 0, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value))
            return NotFound("Character not found");

        var (entries, total) = _logProvider.GetLog(characterId, limit, offset);
        return Ok(new { entries, total });
    }

    [HttpPatch("{characterId}")]
    public ActionResult PatchCharacter(int groupId, int characterId, CharacterPatchData data, [FromQuery] bool witEmptyFields = true, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.CanWriteCharacter(groupId, characterId, userId.Value))
            return Forbidden();
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

            var oldFieldValues = new Dictionary<string, int>();
            if (data.Fields != null)
            {
                foreach (var field in data.Fields)
                {
                    if (field.Value?.Value == null) continue;
                    if (character.Fields.ContainsKey(field.Key))
                        oldFieldValues[field.Key] = character.Fields[field.Key].Value;
                    else if (charlist.Fields.ContainsKey(field.Key))
                        oldFieldValues[field.Key] = charlist.Fields[field.Key].Value;
                }
            }
            var fieldsChanged = TryChangeFields(character, charlist, data, out var errors);
            anythingChanged = (anythingChanged && data.Fields == null) || fieldsChanged;
            if (anythingChanged)
            {
                var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
                GetCollection().ReplaceOne(filter, character);
                DbContext.SaveChanges();

                if (data.Fields != null && userId != null)
                {
                    foreach (var kvp in data.Fields)
                    {
                        if (!kvp.Value.HasValue) continue;
                        var patch = kvp.Value.Value;
                        if (patch.Value == null) continue;
                        int newValue = patch.Value.Value;
                        var oldVal = oldFieldValues.GetValueOrDefault(kvp.Key);
                        if (oldFieldValues.ContainsKey(kvp.Key))
                        {
                            var delta = newValue - oldVal;
                            if (delta != 0)
                                _logProvider.LogFieldChange(characterId, groupId, userId.Value, kvp.Key, oldVal, delta);
                        }
                        else
                        {
                            _logProvider.LogFieldChange(characterId, groupId, userId.Value, kvp.Key, 0, newValue);
                        }
                    }
                }

                if (witEmptyFields)
                    character = AsCharacterWithTemplate(characterData, character);
                FormulaCalculator.CalculateFields(character);
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