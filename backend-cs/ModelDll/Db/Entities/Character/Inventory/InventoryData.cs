namespace Tdn.Model.Db.Entities
{
	internal class InventoryData
	{
		public int Id;
		public int OwnerId;
		
		public CharacterData? Owner;
	}
}