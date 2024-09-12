using TdnApi.Models;
using TdnApi.Models.Db;

namespace TdnApi.Providers;

class UserProvider
{
	private UserGroupContext _context;
	
	public UserProvider(UserGroupContext context)
	{
		_context = context;
	}
	
	public User? FindByTd(string id)
	{
		var users = _context.Users.Where(u => u.Id == id);
		if (users.Count() == 0)
			return null;
		return users.First();
	}
	
	public IEnumerable<User> FindByGroup(string groupId, bool adminsOnly = false)
	{
		var ug = _context.UserGroups.Where(t => t.GroupId == groupId).ToList();
		if (adminsOnly)
			ug.RemoveAll(t => !t.IsAdmin);
		var users = _context.Users.AsEnumerable()
			.Where(t => ug.Any(e => t.Id == e.UserId)).ToList();
		return users;
	}
	
	public void AddToGroup(User user, string groupId, bool isAdmin = false)
	{
		UserGroupContext.GroupUserData ug = 
			new() {UserId = user.Id, GroupId = groupId, IsAdmin = isAdmin};
		_context.Add(ug);
		_context.SaveChanges();
	}
	
	public void DeleteFromGroup(User user, string groupId)
	{
		var ugs = _context.UserGroups
			.Where(t => t.GroupId == groupId && t.UserId == user.Id).ToList();
		if (ugs.Count == 0)
			return;
		var ug = ugs[0];
		_context.UserGroups.Remove(ug);
	}
}

