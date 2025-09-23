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
    private AttributesProvider _attributesProvider;

    public struct AttributePostData
    {
        public string? Key { get; set; }
        public string? Name { get; set; }
        public string? Value { get; set; }
    }

    public struct SkillPostData
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public List<AttributePostData>? Attributes { get; set; }
    }

    public GroupSkillsController(SkillsProvider skillsProvider, AttributesProvider attributesProvider)
    {
        _provider = skillsProvider;
        _attributesProvider = attributesProvider;
    }

    private void UpdateGroupAttributes(int groupId, Skill skill)
    {
        var groupAttributes = _attributesProvider.GetAttributes(groupId);
        var attributesToUpdate = new List<Tdn.Models.Attribute>();

        foreach (var valuedAttr in skill.Attributes)
        {
            var existingAttr = groupAttributes.FirstOrDefault(a => a.Key == valuedAttr.Key);
            if (existingAttr == null)
            {
                attributesToUpdate.Add(new Tdn.Models.Attribute()
                {
                    Key = valuedAttr.Key,
                    Name = valuedAttr.Name,
                    Description = valuedAttr.Description,
                    IsFiltered = false,
                    KnownValues = new List<string>()
                });
            }
            else if (existingAttr.IsFiltered)
            {
                if (!existingAttr.KnownValues.Contains(valuedAttr.Value))
                {
                    existingAttr.KnownValues.Add(valuedAttr.Value);
                    attributesToUpdate.Add(existingAttr);
                }
            }
        }

        if (attributesToUpdate.Any())
        {
            var finalAttributes = groupAttributes
                .Where(ga => !attributesToUpdate.Any(ua => ua.Key == ga.Key))
                .Concat(attributesToUpdate)
                .ToList();
            
            _attributesProvider.TrySaveAttributes(groupId, finalAttributes);
        }
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
                yield return skill;
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
    public ActionResult PostSkill(int groupId, SkillPostData data)
    {
        if (data.Name == null)
            return BadRequest("Name must be not null");

        var skill = new Skill(new Group() { Id = groupId })
        {
            Name = data.Name,
            Description = data.Description != null ? data.Description : "",
            Attributes = data.Attributes == null ? new() : data.Attributes
                                .Where(e => !(e.Key == null || e.Value == null))
                                .Select(e => new ValuedAttribute() { 
                                    Key = e.Key!, 
                                    Name = e.Name ?? e.Key!,
                                    Value = e.Value! 
                                }).ToList()
        };

        if (_provider.TryCreateSkill(groupId, skill))
        {
            UpdateGroupAttributes(groupId, skill);
            return Created($"groups/{groupId}/skills/{skill.Id}", skill.ToResponse());
        }
        else
            return BadRequest("Unknown error");
    }

    [HttpPut("{skillId}")]
    public ActionResult PutSkill(int groupId, int skillId, SkillPostData data)
    {
        if (data.Name == null)
            return BadRequest("Name must be not null");

        Skill? skill = _provider.GetSkill(groupId, skillId);
        if (skill == null)
            return NotFound("Skill not found");
        
        skill.Name = data.Name;
        skill.Description = data.Description != null ? data.Description : "";
        skill.Attributes = data.Attributes == null ? new() : data.Attributes
                            .Where(e => !(e.Key == null || e.Value == null))
                            .Select(e => new ValuedAttribute() { 
                                Key = e.Key!, 
                                Name = e.Name ?? e.Key!,
                                Value = e.Value! 
                            }).ToList();
        
        if (_provider.TryUpdateSkill(skill))
        {
            UpdateGroupAttributes(groupId, skill);
            return Ok(skill.ToResponse());
        }
        else
            return BadRequest("Unknown error");
    }

    [HttpDelete("{skillId}")]
    public ActionResult DeleteSkill(int groupId, int skillId)
    {
        if (_provider.TryDeleteSkill(groupId, skillId))
            return Ok();
        else
            return BadRequest("Unknown error");
    }
    
    
}