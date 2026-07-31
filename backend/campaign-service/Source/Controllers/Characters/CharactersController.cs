using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Processing;
using Tdn.Models.Providing;
using Tdn.Models.Access;
using Tdn.Models.DTOs;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters")]
public class CharactersController : GroupsBaseController
{
    private CharactersProvider _provider;
    private CharacterLogProvider _logProvider;

    public CharactersController(CampaignContext context, SubjectAccessHelper subjectAccessHelper, CharactersProvider provider, CharacterLogProvider logProvider, ILogger<GroupsBaseController> logger) : base(context, subjectAccessHelper, logger)
    {
        _provider = provider;
        _logProvider = logProvider;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId, int? ownerId = null)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        var characters = _provider.GetCharacters(groupId).ToList();
        if (!SubjectAccess.IsAdmin(groupId))
        {
            var accessibleIds = SubjectAccess.GetAccessibleCharacterIds(groupId);
            characters = characters.Where(e => accessibleIds.Contains(e.Id)).ToList();
        }
        if (ownerId != null)
            characters = characters.Where(e => e.OwnerId! == ownerId!).ToList();
        return Ok(characters.Select(e =>
        {
            var data = _provider.GetCharacterSqlData(groupId, e.Id);
            return data!.ToDict(_provider.BuildMongoData(e));
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
                var characterData = _provider.GetCharacterSqlData(groupId, character.Id);
                return Created($"/groups/{groupId}/characters/{character.Id}", characterData!.ToDict(_provider.BuildMongoData(character)));
            }
            return BadRequest();
        }
        return NotFound("Group not found");
    }

    [HttpGet("{characterId}")]
    public ActionResult GetCharacter(int groupId, int characterId, [FromQuery] bool witEmptyFields = true)
    {
        if (!CheckCharacterAccess(groupId, characterId))
            return NotFound("Character not found");
        var character = _provider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var mongoData = _provider.BuildMongoData(character);
            if (witEmptyFields)
                mongoData = _provider.AsCharacterWithTemplate(character, groupId);
            FormulaCalculator.CalculateFields(mongoData);
            var data = _provider.GetCharacterSqlData(groupId, characterId);
            return Ok(data!.ToDict(mongoData));
        }
        return NotFound("Character or Group not found");
    }
          
    [HttpGet("{characterId}/log")]
    public ActionResult GetCharacterLog(int groupId, int characterId, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
    {
        if (!CheckCharacterAccess(groupId, characterId))
            return NotFound("Character not found");

        var (entries, total) = _logProvider.GetLog(characterId, limit, offset);
        return Ok(new { entries, total });
    }

    [HttpPatch("{characterId}")]
    public ActionResult PatchCharacter(int groupId, int characterId, CharacterPatchData data, [FromQuery] bool witEmptyFields = true)
    {
        if (!SubjectAccess.CanWriteCharacter(groupId, characterId))
            return Forbidden();

        var result = _provider.PatchCharacter(groupId, characterId, data, witEmptyFields);

        if (!result.Success)
        {
            if (result.StatusCode == 404)
                return NotFound("Character or Group not found");
            if (result.StatusCode == 400)
                return result.Errors != null
                    ? BadRequest(new { errors = result.Errors })
                    : BadRequest("Nothing to do");
        }

        if (data.Fields != null && result.OldFieldValues != null)
        {
            foreach (var kvp in data.Fields)
            {
                if (!kvp.Value.HasValue) continue;
                var patch = kvp.Value.Value;
                if (patch.Value == null) continue;
                int newValue = patch.Value.Value;

                if (result.OldFieldValues.TryGetValue(kvp.Key, out var oldVal))
                {
                    var delta = newValue - oldVal;
                    if (delta != 0)
                        _logProvider.LogFieldChange(characterId, groupId, SubjectAccess.GetCurrentActorId(), kvp.Key, oldVal, delta);
                }
            }
        }

        return Ok(result.Data);
    }
    
    [HttpDelete("{characterId}")]
    public ActionResult DeleteCharacter(int groupId, int characterId, [FromQuery] bool witEmptyFields = true)
    {
        var character = _provider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var data = _provider.GetCharacterSqlData(groupId, characterId);
            var mongoData = _provider.BuildMongoData(character);
            _provider.TryDeleteCharacter(groupId, characterId);
            if (witEmptyFields)
                mongoData = _provider.AsCharacterWithTemplate(character, groupId);
            return Ok(data!.ToDict(mongoData));
        }
        return NotFound("Character or Group not found");
    }
}
