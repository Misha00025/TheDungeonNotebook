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

    public override void SetNewInfo(ItemInfo info)
    {
        throw new NotImplementedException();
    }
}