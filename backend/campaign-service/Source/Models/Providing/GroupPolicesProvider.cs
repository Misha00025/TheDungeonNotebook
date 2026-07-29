using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class GroupPolicesProvider
{
    private readonly CampaignContext _db;

    public GroupPolicesProvider(CampaignContext context)
    {
        _db = context;
    }

    public IQueryable<UserGroupData> GetGroupRules(int? userId, int? groupId)
    {
        var query = _db.UserGroups.AsQueryable();
        if (userId != null)
            query = query.Where(e => e.UserId == userId.Value);
        if (groupId != null)
            query = query.Where(e => e.GroupId == groupId.Value);
        return query;
    }

    public (bool isCreated, UserGroupData rule) UpsertGroupRule(int groupId, int userId, bool isAdmin)
    {
        var rule = _db.UserGroups
            .FirstOrDefault(e => e.GroupId == groupId && e.UserId == userId);

        if (rule == null)
        {
            rule = new UserGroupData
            {
                UserId = userId,
                GroupId = groupId,
                IsAdmin = isAdmin
            };
            _db.UserGroups.Add(rule);
            _db.SaveChanges();
            return (true, rule);
        }
        else
        {
            rule.IsAdmin = isAdmin;
            _db.SaveChanges();
            return (false, rule);
        }
    }

    public IQueryable<UserCharacterData> GetCharacterRules(int groupId, int? userId, int? characterId)
    {
        var query = _db.UserCharacters.Where(e => e.GroupId == groupId);
        if (userId != null)
            query = query.Where(e => e.UserId == userId.Value);
        if (characterId != null)
            query = query.Where(e => e.CharacterId == characterId.Value);
        return query;
    }

    public (bool isCreated, UserCharacterData? rule)? UpsertCharacterRule(int groupId, int userId, int characterId, bool canWrite)
    {
        if (!_db.UserGroups.Any(e => e.GroupId == groupId && e.UserId == userId))
            return null;

        var rule = _db.UserCharacters
            .FirstOrDefault(e => e.GroupId == groupId && e.UserId == userId && e.CharacterId == characterId);

        if (rule == null)
        {
            rule = new UserCharacterData
            {
                UserId = userId,
                GroupId = groupId,
                CharacterId = characterId,
                CanWrite = canWrite
            };
            _db.UserCharacters.Add(rule);
            _db.SaveChanges();
            return (true, rule);
        }
        else
        {
            rule.CanWrite = canWrite;
            _db.SaveChanges();
            return (false, rule);
        }
    }

    public bool DeleteRule(int userId, int groupId, int? characterId)
    {
        if (characterId != null)
        {
            var character = _db.UserCharacters
                .FirstOrDefault(e => e.UserId == userId && e.CharacterId == characterId.Value && e.GroupId == groupId);
            if (character == null) return false;
            _db.UserCharacters.Remove(character);
        }
        else
        {
            var group = _db.UserGroups
                .FirstOrDefault(e => e.UserId == userId && e.GroupId == groupId);
            if (group == null) return false;

            _db.UserCharacters.RemoveRange(
                _db.UserCharacters.Where(e => e.GroupId == groupId && e.UserId == userId));
            _db.UserGroups.Remove(group);
        }
        _db.SaveChanges();
        return true;
    }
}
