using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
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
    private ILogger<SkillsProvider> _logger;

    public SkillsProvider(SkillsContext skillsContext, MongoDbContext mongoDbContext, AttributesProvider attributesProvider, ILogger<SkillsProvider> logger)
    {
        _sql = skillsContext;
        _mongo = mongoDbContext;
        _attributes = attributesProvider;
        _logger = logger;
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
        catch (Exception e)
        {
            _logger.LogWarning($"Error with create skill: {e}");
            return false;
        }
    }
    
    public bool TryUpdateSkill(Skill skill)
    {
        try
        {
            var skillData = _sql.Skills
                .Include(e => e.Group)
                .FirstOrDefault(e => e.Id == skill.Id && e.GroupId == skill.Group.Id);
            
            if (skillData == null)
                return false;

            var mongoData = new SkillMongoData()
            {
                Id = new ObjectId(skillData.UUID),
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

            var collection = _mongo.GetCollection<SkillMongoData>(SKILLS_COLLECTION_NAME);
            var result = collection.ReplaceOne(
                Builders<SkillMongoData>.Filter.Eq(x => x.Id, new ObjectId(skillData.UUID)),
                mongoData);

            return result.IsAcknowledged && result.ModifiedCount > 0;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error with update skill: {e}");
            return false;
        }
    }
    
    public bool TryDeleteSkill(int groupId, int skillId)
    {
        try
        {
            var skillData = _sql.Skills
                .FirstOrDefault(e => e.GroupId == groupId && e.Id == skillId);
            if (skillData == null)
                return false;
            var collection = _mongo.GetCollection<SkillMongoData>(SKILLS_COLLECTION_NAME);
            var mongoResult = collection.DeleteOne(Builders<SkillMongoData>.Filter.Eq(x => x.Id, new ObjectId(skillData.UUID)));
            _sql.Skills.Remove(skillData);
            _sql.SaveChanges();
            return mongoResult.IsAcknowledged && mongoResult.DeletedCount > 0;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error with delete skill: {e}");
            return false;
        }
    }
    
    public bool TryAddSkillToCharacter(Skill skill, int characterId)
    {
        try
        {
            var existing = _sql.CharacterSkills
                .FirstOrDefault(e => e.CharacterId == characterId && e.SkillId == skill.Id);
            if (existing != null)
                return true;
            var characterSkill = new CharacterSkillData()
            {
                CharacterId = characterId,
                SkillId = skill.Id
            };
            _sql.CharacterSkills.Add(characterSkill);
            _sql.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error adding skill to character: {e}");
            return false;
        }
    }
    
    public bool TryRemoveSkillFromCharacter(Skill skill, int characterId)
    {
        try
        {
            var existing = _sql.CharacterSkills
                .FirstOrDefault(e => e.CharacterId == characterId && e.SkillId == skill.Id);
            if (existing == null)
                return true;
            _sql.CharacterSkills.Remove(existing);
            _sql.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error removing skill from character: {e}");
            return false;
        }
    }
    
    public IEnumerable<Skill> ApplyFilters(IEnumerable<Skill> skills, Dictionary<string, string> filters)
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
}