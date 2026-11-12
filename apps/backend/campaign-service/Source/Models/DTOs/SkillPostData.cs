namespace Tdn.Models.DTOs;

public struct SkillPostData
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public List<AttributePostData>? Attributes { get; set; }
    public bool? IsSecret { get; set; }
}
