using Microsoft.EntityFrameworkCore;
using TdnApi.Models;
using TdnApi.Models.Db;

namespace TdnApi.Providers;

class GroupProvider
{
	private readonly UserGroupContext _context;

	public GroupProvider(UserGroupContext context)
	{
		_context = context;
	}

	public Group? FindById(string id)
	{
		var group = _context.Groups.Where(g => g.Id == id);
		if (group.Count() == 0)
			return null;
		return group.First();
	}

	public IEnumerable<UserGroupContext.GroupUserData> FindByUser(string userId)
	{
		var ugs = _context.UserGroups
			.Where(t => t.UserId == userId)
			.Include(e => e.Group)
			.ToList();
		return ugs;
	}
}