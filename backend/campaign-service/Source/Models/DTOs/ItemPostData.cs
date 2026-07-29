namespace Tdn.Models.DTOs;

public struct ItemPostData
{
    public string Name { get; set; }
    public string Description { get; set; }
    public int? Price { get; set; }
    public List<AttributePostData>? Attributes { get; set; }
    public bool? IsSecret { get; set; }
    public int? Amount { get; set; }
}
