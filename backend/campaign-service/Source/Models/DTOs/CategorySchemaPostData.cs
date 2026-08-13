namespace Tdn.Models.DTOs;

public struct CategorySchemaPostData
{
    public string Name { get; set; }
    public List<string> Fields { get; set; }
    public List<CategorySchemaPostData>? Categories { get; set; }
}
