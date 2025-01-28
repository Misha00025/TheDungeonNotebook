namespace Tdn.Models;

public struct ItemInfo
{
	public int Id;
	public string Name;
	public string Description;
}

public class Item : Entity<ItemInfo>
{
	public Item(ItemInfo info) : base(info)
	{
	}

	public int Id => Info.Id;

	protected override void SetNewInfo(ItemInfo info)
	{
		if (info.Id != Id)
			throw new Exception($"Incorrect info.Id: \"{info.Id}\". Expected: \"{Id}\"");
		_info.Name = info.Name;
		_info.Description = info.Description;
	}
}

public class AmountedItem : Item
{
	private FlexibleField _amount = new FlexibleField();
	
	public AmountedItem(ItemInfo info, int amount) : base(info)
	{
		_amount.SetIntValue(amount);
	}
	
	public AmountedItem(ItemInfo info, float amount) : base(info)
	{
		_amount.SetFloatValue(amount);
	}
	
	public dynamic Amount => _amount.GetValue();
}

