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
	public User(UserInfo info, List<GroupAccess> groups) : base(info)
	{
	}
	
	public int Id => _info.Id;
	public string FirstName => _info.FirstName;
	public string LastName => _info.LastName;
	public string? Icon => _info.Icon;

	public override void SetNewInfo(UserInfo info)
	{
		_info.FirstName = info.FirstName;
		_info.LastName = info.LastName;
		_info.Icon = info.Icon;
	}
}