namespace Tdn.Models;

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