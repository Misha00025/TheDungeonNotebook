namespace Tdn.Models.DTOs;

public struct AttributePostData
{
    public string? Key { get; set; }
    public string? Name { get; set; }
    public string? Value { get; set; }
    public string? Description { get; set; }
    public bool? isFiltered { get; set; }
}
