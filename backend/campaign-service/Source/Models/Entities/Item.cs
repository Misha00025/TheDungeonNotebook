namespace Tdn.Models;

public struct ItemPostData
{
    public string Name { get; set; }
    public string Description { get; set; }
    public int? Price { get; set; }
    public List<AttributePostData>? Attributes { get; set; }
    public bool? IsSecret { get; set; }
    public int? Amount { get; set; }
}

public class Item
{
    public int Id;
    public string Name = "";
    public string Description = "";
    public int Price;
    public int? Amount;
    public Group Group { get; private set; }
    public List<ValuedAttribute> Attributes = new ();
    public bool IsSecret;
    
    public Item(Group group)
    {
        Group = group;
    }
}