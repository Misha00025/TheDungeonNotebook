namespace Tdn.Model.Db.Entities
{
	internal class ItemData
	{
		public int Id;
		public int GroupId;
		public string Name = "";
		public string Description = "";
		public string? Image;
		
		public GroupData? Group;
	}
}