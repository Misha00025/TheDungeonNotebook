using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class GroupProvider : SQLModelProvider<Group, GroupContext, GroupData>
{
	public GroupProvider(GroupContext dbContext) : base(dbContext)
	{
	}

	protected override Group BuildModel(GroupData? data)
	{
		var info = Convert(data);
		return new Group(info, new());
	}

	private GroupInfo Convert(GroupData? data)
	{		
		if (data == null)
			throw new Exception("Group not found");
		var info = new GroupInfo(){
			Id = data.Id, 
			Name = data.Name,
			Icon = data.Icon			
		};
		return info;
	}
}