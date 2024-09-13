using Microsoft.EntityFrameworkCore;
using TdnApi.Models;
using TdnApi.Models.Db;

namespace TdnApi.Providers;

class UserProvider : IGroupedProvider<User>
{
	private readonly UserGroupContext _context;
	
	public UserProvider(UserGroupContext context)
	{
		_context = context;
	}
	
	public User? FindById(string id)
	{
		var users = _context.Users.Where(u => u.Id == id);
		if (users.Count() == 0)
			return null;
		return users.First();
	}
	
	public IEnumerable<User> FindByGroup(string groupId)
	{
		return FindByGroup(groupId, false);
	}
	
	public IEnumerable<User> FindByGroup(string groupId, bool adminsOnly)
	{
		var ugs = _context.UserGroups.Where(t => t.GroupId == groupId).Include(e => e.User).ToList();
		if (adminsOnly)
			ugs.RemoveAll(t => !t.IsAdmin);
		List<User> users = new();
		foreach (var ug in ugs)
		{
			if (ug.User != null)
				users.Add(ug.User);
			else
				Console.WriteLine("----\nnull\n----");
		}
		return users;
	}
	
	public void AddToGroup(User user, string groupId, bool isAdmin = false)
	{
		UserGroupContext.GroupUserData ug = 
			new() {UserId = user.Id, GroupId = groupId, IsAdmin = isAdmin};
		_context.UserGroups.Add(ug);
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
		_context.SaveChanges();
	}
}

