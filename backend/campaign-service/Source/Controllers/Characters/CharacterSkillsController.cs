using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters/{characterId}/skills")]
public class CharacterSkillsController : BaseController
{
    private SkillsProvider _provider;

    public CharacterSkillsController(SkillsProvider skillsProvider)
    {
        _provider = skillsProvider;
    }
    
    private IEnumerable<Skill> ApplyFilters(IEnumerable<Skill> skills, Dictionary<string, string> filters) => _provider.ApplyFilters(skills, filters);
    
    [HttpGet]
    public ActionResult GetSkills(int groupId, int characterId, [FromQuery] Dictionary<string, string>? filters = null)
    {
        var skills = _provider.GetSkills(groupId, characterId);
        if (filters != null && filters.Any())
            skills = ApplyFilters(skills, filters);
        return Ok(new
        {
            skills = skills.Select(e => e.ToResponse()).ToList(),
            total = skills.Count()
        });
    }
    
    [HttpPut("{skillId}")]
    public ActionResult PutSkill(int groupId, int characterId, int skillId)
    {
        var skill = _provider.GetSkill(groupId, skillId);
        if (skill == null)
            return NotFound(new { error = $"Skill with id {skillId} not found in group {groupId}" });
        if (_provider.TryAddSkillToCharacter(skill, characterId))
            return Ok(skill.ToResponse());
        else
            return BadRequest("Unknown error");
    }
    
    [HttpDelete("{skillId}")]
    public ActionResult DeleteSkill(int groupId, int characterId, int skillId)
    {
        var skill = _provider.GetSkill(groupId, skillId);
        if (skill == null)
            return NotFound(new { error = $"Skill with id {skillId} not found in group {groupId}" });
        if (_provider.TryRemoveSkillFromCharacter(skill, characterId))
            return Ok(skill.ToResponse());
        else
            return BadRequest("Unknown error");
    }
}