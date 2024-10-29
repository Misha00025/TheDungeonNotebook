namespace TdnApi.Db.Entities
{
	public class InventoryData
	{
		public int Id;
		public int OwnerId;
		
		public CharacterData? Owner;
	}
}