namespace TdnApi.Db.Entities
{
	internal class UserGroupData
	{
		public int UserId;
		public int GroupId;
		public string Privileges = "";
		
		public UserData? User;
		public GroupData? Group;
	}
}