using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class SkillsProvider : DualDbRepository<Skill, SkillData, SkillMongoData>
{
    private AttributesProvider _attributes;

    public SkillsProvider(CampaignContext context, IMongoDbContext mongoDbContext, AttributesProvider attributesProvider, ILogger<SkillsProvider> logger)
        : base(context, mongoDbContext, logger)
    {
        _attributes = attributesProvider;
    }

    protected override string CollectionName => "skills";

    protected override Expression<Func<SkillData, bool>> GroupFilter(int groupId) => e => e.GroupId == groupId;
    protected override Expression<Func<SkillData, bool>> IdFilter(int groupId, int entityId) => e => e.GroupId == groupId && e.Id == entityId;
    protected override int GetGroupId(Skill entity) => entity.Group.Id;
    protected override int GetEntityId(Skill entity) => entity.Id;
    protected override void SetEntityId(Skill entity, int id) => entity.Id = id;

    protected override Skill ToDomain(SkillData sqlData, SkillMongoData mongoData) => ToSkill(sqlData, mongoData);

    protected override SkillMongoData ToMongoData(Skill entity) => new SkillMongoData()
    {
        Name = entity.Name,
        Description = entity.Description,
        Attributes = entity.Attributes
            .Select(e => new ValuedAttributeMongoData()
            {
                Key = e.Key,
                Value = e.Value
            })
            .ToList(),
        IsSecret = entity.IsSecret
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
        skill.IsSecret = mongoData.IsSecret;
        return skill;
    }

    public Skill? GetSkill(int groupId, int skillId) => Get(groupId, skillId);

    public IEnumerable<Skill> GetSkills(int groupId) => GetByGroup(groupId);

    public IEnumerable<Skill> GetSkills(int groupId, int characterId)
    {
        return Db.CharacterSkills
            .Include(e => e.Skill)
            .Include(e => e.Skill.Group)
            .Where(e => e.Skill.GroupId == groupId && e.CharacterId == characterId)
            .AsEnumerable()
            .Select(e => FromSqlData(e.Skill))
            .Where(e => e != null)
            .ToList()!;
    }

    public bool TryCreateSkill(int groupId, Skill skill) => TryCreate(groupId, skill);

    public bool TryUpdateSkill(Skill skill) => TryUpdate(skill);

    public bool TryDeleteSkill(int groupId, int skillId) => TryDelete(groupId, skillId);

    public bool TryAddSkillToCharacter(Skill skill, int characterId)
    {
        try
        {
            var existing = Db.CharacterSkills
                .FirstOrDefault(e => e.CharacterId == characterId && e.SkillId == skill.Id);
            if (existing != null)
                return true;
            var characterSkill = new CharacterSkillData()
            {
                CharacterId = characterId,
                SkillId = skill.Id
            };
            Db.CharacterSkills.Add(characterSkill);
            Db.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error adding skill to character: {e}");
            return false;
        }
    }

    public bool TryRemoveSkillFromCharacter(Skill skill, int characterId)
    {
        try
        {
            var existing = Db.CharacterSkills
                .FirstOrDefault(e => e.CharacterId == characterId && e.SkillId == skill.Id);
            if (existing == null)
                return true;
            Db.CharacterSkills.Remove(existing);
            Db.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error removing skill from character: {e}");
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
