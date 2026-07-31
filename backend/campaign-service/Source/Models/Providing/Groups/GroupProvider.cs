using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Access;

namespace Tdn.Models.Providing;

public class GroupProvider
{
    private CampaignContext _db;
    private readonly SubjectAccessHelper _subjectAccessHelper;

    public GroupProvider(CampaignContext context, SubjectAccessHelper subjectAccessHelper)
    {
        _db = context;
        _subjectAccessHelper = subjectAccessHelper;
    }

    public List<Group> GetAll()
    {
        var accessibleIds = _subjectAccessHelper.GetAccessibleGroupIds();
        var groups = _db.Groups.ToList();

        if (accessibleIds.Count > 0)
        {
            groups = groups.Where(e => accessibleIds.Contains(e.Id)).ToList();
        }

        return groups.Select(e => new Group
        {
            Id = e.Id,
            Name = e.Name,
            Icon = e.Icon,
            Description = ""
        }).ToList();
    }

    public Group? Get(int groupId)
    {
        var data = _db.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (data == null) return null;
        return new Group { Id = data.Id, Name = data.Name, Icon = data.Icon, Description = "" };
    }

    public Group Create(string name, string? icon)
    {
        var data = new GroupData { Name = name, Icon = icon };
        _db.Add(data);
        _db.SaveChanges();

        var userId = _subjectAccessHelper.CurrentUserId;
        if (userId != null)
        {
            _db.UserGroups.Add(new UserGroupData
            {
                UserId = userId.Value,
                GroupId = data.Id,
                IsAdmin = true
            });
            _db.SaveChanges();
        }

        return new Group { Id = data.Id, Name = data.Name, Icon = data.Icon, Description = "" };
    }

    public Group? Update(int groupId, string? name, string? icon)
    {
        var data = _db.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (data == null) return null;
        if (name != null) data.Name = name;
        if (icon != null) data.Icon = icon;
        _db.SaveChanges();
        return new Group { Id = data.Id, Name = data.Name, Icon = data.Icon, Description = "" };
    }

    public Group? Delete(int groupId)
    {
        var data = _db.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (data == null) return null;
        var group = new Group { Id = data.Id, Name = data.Name, Description = "" };
        
        _db.UserCharacters.RemoveRange(_db.UserCharacters.Where(e => e.GroupId == groupId));
        _db.UserGroups.RemoveRange(_db.UserGroups.Where(e => e.GroupId == groupId));
        _db.Groups.Remove(data);
        
        _db.SaveChanges();
        return group;
    }
}
