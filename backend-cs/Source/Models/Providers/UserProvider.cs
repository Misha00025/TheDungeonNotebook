using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Convertors;
using Tdn.Db.Entities;
using Tdn.Security;

namespace Tdn.Models.Providing;

public class UserProvider : IModelProvider<User>
{
	private int _lastId;
	private UserData? _lastData;
	
	private UserContext _dbContext;
	
	public UserProvider(UserContext dbContext)
	{
		_dbContext = dbContext;
	}
	
	private UserData? Find(int id)
	{
		if (id != _lastId)
		{
			_lastId = id;
			_lastData = _dbContext.Users.FirstOrDefault(e => e.Id == id);	
		}
		return _lastData;
	}
	
	private UserInfo Convert(UserData? data)
	{		
		if (data == null)
			throw new Exception("User not found");
		var info = new UserInfo(){
			Id = data.Id, 
			FirstName = data.FirstName, 
			LastName = data.LastName,
			Icon = data.PhotoLink			
		};
		return info;
	}
	
	private List<User.GroupAccess> GetGroups(int userId)
	{
		var data = _dbContext.Groups.Where(e => e.UserId == userId).Include(e => e.Group).ToArray();
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
	
	public User GetModel(string uuid)
	{
		if (!int.TryParse(uuid, out int id))
			throw new Exception("Can't parse uuid to int to find User");
		var info = Convert(Find(id));
		var groups = GetGroups(id);
		var user = new User(info, groups);
		return user;
	}

	public bool TrySaveModel(User model)
	{
		var data = Find(model.Id);
		bool isNew = data == null;
		if (data == null)
			data = new UserData();
		data.FirstName = model.FirstName;
		data.LastName = model.LastName;
		data.PhotoLink = model.Icon;
		try
		{		
			if (isNew)
				_dbContext.Users.Add(data);
			_dbContext.SaveChanges();
			return true;
		}
		catch
		{
			return false;
		}
	}
}