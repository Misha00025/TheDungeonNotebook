using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class SkillsProvider 
{
    private const string SKILLS_COLLECTION_NAME = "skills";
    
    private SkillsContext _sql;
    private MongoDbContext _mongo;
    private AttributesProvider _attributes;

    public SkillsProvider(SkillsContext skillsContext, MongoDbContext mongoDbContext, AttributesProvider attributesProvider)
    {
        _sql = skillsContext;
        _mongo = mongoDbContext;
        _attributes = attributesProvider;
    }

    private static Group ToGroup(GroupData data) => new()
    {
        Id = data.Id,
        Name = data.Name,
        Description = data.Name
    };

    private ValuedAttribute ToAttribute(int groupId, ValuedAttributeMongoData data)
    {
        Attribute attribute;
        if (!_attributes.TryGetAttribute(groupId, data.Key, out attribute))
            attribute = new()
            {
                Key = data.Key,
                Name = data.Key,
            };
    
        return new()
        {
            Key = attribute.Key,
            Name = attribute.Name,
            Description = attribute.Description,
            Value = data.Value
        };
    } 
    
    private Skill ToSkill(SkillData data, SkillMongoData mongoData)
    {
        var group = ToGroup(data.Group);
        var skill = new Skill(group);
        skill.Id = data.Id;
        skill.Name = mongoData.Name;
        skill.Description = mongoData.Description;
        skill.Attributes = mongoData.Attributes.Select(e => ToAttribute(data.GroupId, e)).ToList();
        return skill;
    }
    
    private Skill GetSkill(SkillData data)
    {
        var mongoData = _mongo.GetEntity<SkillMongoData>(SKILLS_COLLECTION_NAME, data.UUID);
        return ToSkill(data, mongoData!);
    }
    
    public Skill? GetSkill(int groupId, int skillId)
    {
        var data = _sql.Skills
                    .Where(e => e.GroupId == groupId && e.Id == skillId)
                    .Include(e => e.Group)
                    .FirstOrDefault();
        if (data == null)
            return null;
        return GetSkill(data);
    }
    
    public IEnumerable<Skill> GetSkills(int groupId)
    {
        var skills = _sql.Skills
                        .Where(e => e.GroupId == groupId)
                        .Include(e => e.Group)
                        .AsEnumerable()
                        .Select(GetSkill)
                        .ToList();
        return skills;
    }
    
    public IEnumerable<Skill> GetSkills(int groupId, int characterId)
    {
        var skills = _sql.CharacterSkills
                        .Include(e => e.Skill)
                        .Include(e => e.Skill.Group)
                        .Where(e => e.Skill.GroupId == groupId && e.CharacterId == characterId)
                        .AsEnumerable()
                        .Select(e => GetSkill(e.Skill))
                        .ToList();
        return skills;
    }
    
    public bool TryCreateSkill(int groupId, Skill skill)
    {
        try
        {
            var mongoData = new SkillMongoData()
            {
                Name = skill.Name,
                Description = skill.Description,
                Attributes = skill.Attributes
                    .Select(e => new ValuedAttributeMongoData()
                    {
                        Key = e.Key,
                        Value = e.Value
                    })
                    .ToList()
            };
            _mongo.GetCollection<SkillMongoData>(SKILLS_COLLECTION_NAME).InsertOne(mongoData);
            SkillData data = new SkillData() { GroupId = groupId, UUID = mongoData.Id.ToString() };
            _sql.Skills.Add(data);
            _sql.SaveChanges();
            skill.Id = data.Id;
            return true;
        }
        catch
        {
            return false;
        }
    }
    
    public bool TryUpdateSkill(Skill skill)
    {
        return false;
    }
}