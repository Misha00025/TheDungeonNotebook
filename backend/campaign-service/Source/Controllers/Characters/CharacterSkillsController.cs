using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models;
using Tdn.Models.Access;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters/{characterId}/skills")]
public class CharacterSkillsController : GroupsBaseController
{
    private SkillsProvider _provider;
    private CharacterLogProvider _logProvider;

    public CharacterSkillsController(CampaignContext context, SkillsProvider skillsProvider, CharacterLogProvider logProvider, SubjectAccessHelper subjectAccessHelper, ILogger<GroupsBaseController> logger) : base(context, subjectAccessHelper, logger)
    {
        _provider = skillsProvider;
        _logProvider = logProvider;
    }
    
    private IEnumerable<Skill> ApplyFilters(IEnumerable<Skill> skills, Dictionary<string, string> filters) => _provider.ApplyFilters(skills, filters);
    
    [HttpGet]
    public ActionResult GetSkills(int groupId, int characterId, [FromQuery] Dictionary<string, string>? filters = null)
    {
        if (!CheckCharacterAccess(groupId, characterId))
            return NotFound();
            
        var skills = _provider.GetSkills(groupId, characterId);
        if (filters != null && filters.Any())
            skills = ApplyFilters(skills, filters.Where(e => e.Key != "userId").ToDictionary());
        return Ok(new
        {
            skills = skills.Select(e => e.ToResponse()).ToList(),
            total = skills.Count()
        });
    }
    
    [HttpPut("{skillId}")]
    public ActionResult PutSkill(int groupId, int characterId, int skillId)
    {
        if (!SubjectAccess.CanWriteCharacter(groupId, characterId))
            return Forbidden();

        var skill = _provider.GetSkill(groupId, skillId);
        if (skill == null)
            return NotFound(new { error = $"Skill with id {skillId} not found in group {groupId}" });
        if (_provider.TryAddSkillToCharacter(skill, characterId))
        {
            _logProvider.LogSkillChange(characterId, groupId, SubjectAccess.GetCurrentActorId(), skillId, 0, 1);
            return Ok(skill.ToResponse());
        }
        else
            return BadRequest("Unknown error");
    }
    
    [HttpDelete("{skillId}")]
    public ActionResult DeleteSkill(int groupId, int characterId, int skillId)
    {
        if (!SubjectAccess.CanWriteCharacter(groupId, characterId))
            return Forbidden();
            
        var skill = _provider.GetSkill(groupId, skillId);
        if (skill == null)
            return NotFound(new { error = $"Skill with id {skillId} not found in group {groupId}" });
        if (_provider.TryRemoveSkillFromCharacter(skill, characterId))
        {
            _logProvider.LogSkillChange(characterId, groupId, SubjectAccess.GetCurrentActorId(), skillId, 1, -1);
            return Ok(skill.ToResponse());
        }
        else
            return BadRequest("Unknown error");
    }
}
