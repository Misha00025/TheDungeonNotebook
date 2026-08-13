namespace Tdn.Models.DTOs;

public struct TemplatePostData
{
    public string Name { get; set; }
    public string Description { get; set; }
    public Dictionary<string, FieldPostData> Fields { get; set; }
}
