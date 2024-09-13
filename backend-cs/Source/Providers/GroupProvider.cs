using TdnApi.Models;
using TdnApi.Models.Db;

namespace TdnApi.Providers;

class GroupProvider : IUsersProvider<Group>
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

	public IEnumerable<Group> FindByUser(string userId)
	{
		var ugs = _context.UserGroups.Where(t => t.UserId == userId).ToList();
		List<Group> groups = new();
		foreach (var ug in ugs)
		{
			if (ug.Group != null)
				groups.Add(ug.Group);
		}
		return groups;
	}
}