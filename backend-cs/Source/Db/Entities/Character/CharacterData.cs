namespace Tdn.Model.Db.Entities
{
	internal class CharacterData
	{
		public int Id;
		public int GroupId;
		public string Name = "";
		public string Description = "";
		
		public GroupData? Group;
	}
}