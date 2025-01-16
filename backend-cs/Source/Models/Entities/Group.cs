namespace Tdn.Models;

public struct GroupInfo
{
	public int Id;
	public string Name;
	public string? Icon;
}

public class Group : Entity<GroupInfo>
{
	public Group(GroupInfo info) : base(info)
	{
	}
	
	public int Id => _info.Id;
	public string Name => _info.Name;
	public string? Icon => _info.Icon;

	public override void SetNewInfo(GroupInfo info)
	{
		
	}
}