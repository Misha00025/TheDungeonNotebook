using Microsoft.EntityFrameworkCore;
using TdnApi.Models;
using TdnApi.Models.Db;

namespace TdnApi.Providers;

public class NoteProvider : IUserGroupProvider<Note>
{
	private TdnDbContext _context;
	private DbSet<Note> Notes => _context.Notes;
	
	public NoteProvider(TdnDbContext context)
	{
		_context = context;
	}

	public Note? FindById(string id)
	{
		if (int.TryParse(id, out var i))
			return FindById(i);
		return null;
	}
	
	public Note? FindById(int id)
		=> Notes.Where(e => e.Id == id).FirstOrDefault();
	
	public IEnumerable<Note> FindByGroup(string groupId)
		=> Notes.Where(e => e.GroupId == groupId).ToArray();

	public IEnumerable<Note> FindByUser(string userId) 
		=> Notes.Where(e => e.OwnerId == userId).ToArray();

	public IEnumerable<Note> FindByUserGroup(string userId, string groupId)
		=> Notes.Where(e => e.GroupId == groupId && e.OwnerId == userId).ToArray();
}