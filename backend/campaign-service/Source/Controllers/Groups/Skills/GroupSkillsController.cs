using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/skills")]
public class GroupSkillsController : BaseController
{
    private SkillsProvider _provider;

    public struct SkillPostData 
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
    }

    public GroupSkillsController(SkillsProvider skillsProvider)
    {
        _provider = skillsProvider;
    }
    
    private IEnumerable<Skill> ApplyFilters(IEnumerable<Skill> skills, Dictionary<string, string> filters)
{
    foreach (var skill in skills)
    {
        var matchesAllFilters = true;
        
        foreach (var filter in filters)
        {
            var attribute = skill.Attributes.FirstOrDefault(a => 
                a.Key.Equals(filter.Key, StringComparison.OrdinalIgnoreCase));
            
            if (attribute == null || !attribute.Value.Equals(filter.Value, StringComparison.OrdinalIgnoreCase))
            {
                matchesAllFilters = false;
                break;
            }
        }
        
        if (matchesAllFilters)
        {
            yield return skill;
        }
    }
}
    
    [HttpGet]
    public ActionResult GetSkills(int groupId, [FromQuery] Dictionary<string, string>? filters = null)
    {
        var skills = _provider.GetSkills(groupId);
        if (filters != null && filters.Any())
            skills = ApplyFilters(skills, filters);
        return Ok(new 
        {
            skills = skills.Select(e => e.ToResponse()).ToList(),
            total = skills.Count()
        });
    }
    
    [HttpGet("{skillId}")]
    public ActionResult GetSkill(int groupId, int skillId)
    {
        var skill = _provider.GetSkill(groupId, skillId);
        if (skill == null)
            return NotFound();
        return Ok(skill.ToResponse());
    }
    
    [HttpPost]
    public ActionResult PostSkill(int groupId, SkillPostData skill)
    {
        return NotImplemented();
    }
    
    [HttpPut("{skillId}")]
    public ActionResult PutSkill(int groupId, int skillId, SkillPostData skill)
    {
        return NotImplemented();
    }
}