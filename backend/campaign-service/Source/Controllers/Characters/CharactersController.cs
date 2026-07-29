using Microsoft.AspNetCore.Mvc;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Processing;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters")]
public class CharactersController : GroupsBaseController
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

    private CharactersProvider _provider;
    private CharacterLogProvider _logProvider;

    public CharactersController(CampaignContext context, GroupAccessHelper accessHelper, CharactersProvider provider, CharacterLogProvider logProvider) : base(context, accessHelper)
    {
        _provider = provider;
        _logProvider = logProvider;
    }

    private static CharacterMongoData BuildMongoData(Character c) => new CharacterMongoData
    {
        Name = c.Name,
        Description = c.Description,
        Fields = c.Fields,
        Items = c.Items,
        Equipment = c.Equipment,
    };
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int? ownerId = null, [FromQuery] int? userId = null)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        var characters = _provider.GetCharacters(groupId).ToList();
        if (userId != null)
        {
            if (!AccessHelper.HasGroupAccess(groupId, userId.Value))
                return NotFound("Group not found");
            if (!AccessHelper.IsAdmin(groupId, userId.Value))
            {
                var accessibleIds = AccessHelper.GetAccessibleCharacterIds(groupId, userId.Value);
                characters = characters.Where(e => accessibleIds.Contains(e.Id)).ToList();
            }
        }
        if (ownerId != null)
            characters = characters.Where(e => e.OwnerId! == ownerId!).ToList();
        return Ok(characters.Select(e =>
        {
            var data = DbContext.Set<CharacterData>().FirstOrDefault(cd => cd.Id == e.Id && cd.GroupId == groupId);
            return data!.ToDict(BuildMongoData(e));
        }));
    }
    
    [HttpPost]
    public ActionResult PostCharacter(int groupId, [FromBody] CharacterPostData data, [FromQuery] bool copyTemplate = false)
    {
        if (data.TemplateId == null)
            return BadRequest("TemplateId must be not null");
        if (TryGetGroup(groupId, out var _))
        {
            var template = _provider.GetTemplate(groupId, data.TemplateId.Value);
            if (template == null)
                return NotFound("Template not found");
            var character = new Character()
            {
                GroupId = groupId,
                TemplateId = data.TemplateId.Value,
                Name = data.Name,
                Description = data.Description,
            };
            if (copyTemplate)
                character.Fields = template.Fields;
            if (_provider.TryCreateCharacter(groupId, character))
            {
                var characterData = DbContext.Set<CharacterData>().FirstOrDefault(cd => cd.Id == character.Id && cd.GroupId == groupId);
                return Created($"/groups/{groupId}/characters/{character.Id}", characterData!.ToDict(BuildMongoData(character)));
            }
            return BadRequest();
        }
        return NotFound("Group not found");
    }

    private CharacterMongoData AsCharacterWithTemplate(Character character)
    {
        var template = _provider.GetTemplate(character.GroupId, character.TemplateId);
        var mongoData = BuildMongoData(character);
        if (template == null)
            return mongoData;
        return mongoData.CompareWith(template);
    }

    [HttpGet("{characterId}")]
    public ActionResult GetCharacter(int groupId, int characterId, [FromQuery] bool witEmptyFields = true, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value))
            return NotFound("Character not found");
        var character = _provider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var mongoData = BuildMongoData(character);
            if (witEmptyFields)
                mongoData = AsCharacterWithTemplate(character);
            FormulaCalculator.CalculateFields(mongoData);
            var data = DbContext.Set<CharacterData>().FirstOrDefault(cd => cd.Id == characterId && cd.GroupId == groupId);
            return Ok(data!.ToDict(mongoData));
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
    
    private bool TryChangeFields(CharacterMongoData character, TemplateMongoData template, CharacterPatchData data, out List<string> errors)
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
        var character = _provider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var anythingChanged = false;
            var mongoData = BuildMongoData(character);
            anythingChanged = anythingChanged || TryChangeProperties(mongoData, data);
            var template = _provider.GetTemplate(groupId, character.TemplateId);
            if (template == null)
                return NotFound("Template not found");

            var oldFieldValues = new Dictionary<string, int>();
            if (data.Fields != null)
            {
                foreach (var field in data.Fields)
                {
                    if (field.Value?.Value == null) continue;
                    if (mongoData.Fields.ContainsKey(field.Key))
                        oldFieldValues[field.Key] = mongoData.Fields[field.Key].Value;
                    else if (template.Fields.ContainsKey(field.Key))
                        oldFieldValues[field.Key] = template.Fields[field.Key].Value;
                }
            }
            var fieldsChanged = TryChangeFields(mongoData, template, data, out var errors);
            anythingChanged = (anythingChanged && data.Fields == null) || fieldsChanged;
            if (anythingChanged)
            {
                character.Name = mongoData.Name;
                character.Description = mongoData.Description;
                character.Fields = mongoData.Fields;
                character.Items = mongoData.Items;
                character.Equipment = mongoData.Equipment;

                _provider.TryUpdateCharacter(character);

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
                    mongoData = AsCharacterWithTemplate(character);
                FormulaCalculator.CalculateFields(mongoData);
                var resultData = DbContext.Set<CharacterData>().FirstOrDefault(cd => cd.Id == characterId && cd.GroupId == groupId);
                var result = resultData!.ToDict(mongoData);
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
        var character = _provider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var data = DbContext.Set<CharacterData>().FirstOrDefault(cd => cd.Id == characterId && cd.GroupId == groupId);
            var mongoData = BuildMongoData(character);
            _provider.TryDeleteCharacter(groupId, characterId);
            if (witEmptyFields)
                mongoData = AsCharacterWithTemplate(character);
            return Ok(data!.ToDict(mongoData));
        }
        return NotFound("Character or Group not found");
    }
}
