namespace TdnApi.Db.Entities
{
	internal class UserGroupData
	{
		public int UserId;
		public int GroupId;
		public int Privileges;
		
		public UserData? User;
		public GroupData? Group;
	}
}