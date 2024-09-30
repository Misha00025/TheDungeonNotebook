using Microsoft.EntityFrameworkCore;

namespace TdnApi.Models;

[Keyless]
public class InventoryItem
{
	public int ItemId;
	public int InventoryId;
	public int Amount;
	
	public Item? Item;
	public Inventory? Inventory; 
}