namespace TdnApi.Db.Entities
{
	public class ItemInventoryData
	{
		public int ItemId;
		public int InventoryId;
		public int Amount;
		
		public ItemData? Item;
		public InventoryData? Inventory;
	}
}