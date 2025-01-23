using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Convertors;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class GroupProvider : SQLModelProvider<Group, GroupData>
{
	public GroupProvider(GroupContext dbContext) : base(dbContext) {}

	protected override Group BuildModel(GroupData? data)
	{
		var info = Convert(data);
		var users = GetUsers(info);
		return new Group(info, users);
	}

	private List<Group.UserAccess> GetUsers(GroupInfo info)
	{
		var list = _dbContext.Set<UserGroupData>()
					.Include(e => e.User)
					.Where(e => e.GroupId == info.Id)
					.Select(e => 
						new Group.UserAccess()
						{
							Info = e.User == null ? new UserInfo() : e.User.ToInfo(),
							AccessLevel = e.Privileges.ToAccessLevel()
						}
					)
					.ToList();
		return list;
	}

	private GroupInfo Convert(GroupData? data)
	{		
		if (data == null)
			throw new Exception("Group not found");
		var info = new GroupInfo()
		{
			Id = data.Id, 
			Name = data.Name,
			Icon = data.Icon
		};
		return info;
	}
}