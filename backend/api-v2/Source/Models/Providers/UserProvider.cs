using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Convertors;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class UserProvider : SQLModelProvider<User, UserData>
{
	public UserProvider(UserContext dbContext) : base(dbContext)
	{
	}

	private UserInfo Convert(UserData? data)
	{		
		if (data == null)
			throw new Exception("User not found");
		var info = data.ToInfo();
		return info;
	}
	
	private List<User.GroupAccess> GetGroups(int userId)
	{
		var data = _dbContext.Set<UserGroupData>().Where(e => e.UserId == userId).Include(e => e.Group).ToArray();
		List<User.GroupAccess> groups = data.Select(e => 
		{
			if (e.Group == null)
				throw new Exception("Group is null, but it is impossible");
			var info = new GroupInfo()
			{
				Id = e.GroupId,
				Name = e.Group.Name,
				Icon = e.Group.Icon
			};
			return new User.GroupAccess()
			{
				info = info,
				accessLevel = e.Privileges.ToAccessLevel()
			};
		}).ToList();
				
		return groups;
	}

	protected override User BuildModel(UserData? data)
	{
		var info = Convert(data);
		var groups = GetGroups(info.Id);
		var user = new User(info, groups);
		return user;
	}
}