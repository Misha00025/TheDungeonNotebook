namespace Tdn.Models;

public struct ItemInfo
{
	public int Id;
	public string Name;
	public string Description;
	public int GroupId;
}

public class Item : Entity<ItemInfo>
{
	public Item(ItemInfo info) : base(info)
	{
	}

	public int Id => Info.Id;

	protected override void SetNewInfo(ItemInfo info)
	{
		if (info.Id != Id && info.Id != 0)
			throw new Exception($"Incorrect info.Id: \"{info.Id}\". Expected: \"{Id}\" or \"0\"");
		_info.Name = info.Name;
		_info.Description = info.Description;
	}
}

public class AmountedItem : Item
{
	public AmountedItem(ItemInfo info, int amount) : base(info)
	{
		Amount = amount;
	}
	
	public int Amount;
}

