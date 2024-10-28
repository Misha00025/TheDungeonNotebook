namespace TdnApi.Db.Entities
{
	internal class ItemInventoryData
	{
		public int ItemId;
		public int InventoryId;
		public int Amount;
		
		public ItemData? Item;
		public InventoryData? Inventory;
	}
}