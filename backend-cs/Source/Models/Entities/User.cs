using Tdn.Security;

namespace Tdn.Models;

public struct UserInfo
{
	public int Id;
	public string FirstName;
	public string LastName;
	public string? Icon;
}

public class User : Entity<UserInfo>
{
	public struct GroupAccess
	{
		public GroupInfo info;
		public AccessLevel accessLevel;
	}
	
	private List<GroupAccess> _groups;
	
	public User(UserInfo info, List<GroupAccess>? groups = null) : base(info)
	{
		if (groups == null)
			groups = new();
		_groups = groups;
	}
	
	public UserInfo Info => _info;
	public int Id => _info.Id;
	public string FirstName => _info.FirstName;
	public string LastName => _info.LastName;
	public string? Icon => _info.Icon;
	public IReadOnlyList<GroupAccess> Groups => _groups;

	public override void SetNewInfo(UserInfo info)
	{
		_info.FirstName = info.FirstName;
		_info.LastName = info.LastName;
		_info.Icon = info.Icon;
	}
}