using Tdn.Security;

namespace Tdn.Models;

public struct GroupInfo
{
	public int Id;
	public string Name;
	public string? Icon;
}

public class Group : Entity<GroupInfo>
{
	public struct UserAccess 
	{
		public UserInfo Info;
		public AccessLevel AccessLevel;
	}
	private List<UserAccess> _users;
	
	public Group(GroupInfo info, List<UserAccess> users) : base(info)
	{
		_users = users;
	}
	
	public GroupInfo Info => _info;
	public int Id => _info.Id;
	public string Name => _info.Name;
	public string? Icon => _info.Icon;
	
	public IReadOnlyList<UserInfo> Admins => GetUsers(AccessLevel.Full);
	public IReadOnlyList<UserInfo> Users => GetUsers(AccessLevel.Read);
	
	
	private IReadOnlyList<UserInfo> GetUsers(AccessLevel accessLevel)
	{
		return _users
			.Where(e => e.AccessLevel == accessLevel)
			.Select(e => e.Info)
			.ToList();
	}

	public override void SetNewInfo(GroupInfo info)
	{
		
	}
}