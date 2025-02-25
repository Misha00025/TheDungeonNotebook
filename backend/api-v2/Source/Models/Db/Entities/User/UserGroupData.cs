namespace Tdn.Db.Entities
{
	public class UserGroupData
	{
		public int UserId;
		public int GroupId;
		public int Privileges;
		
		public UserData? User;
		public GroupData? Group;
	}
}