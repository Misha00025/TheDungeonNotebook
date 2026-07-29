namespace Tdn.Models.DTOs;

public struct FieldPatchData
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? Value { get; set; }
    public int? MaxValue { get; set; }
    public string? Formula { get; set; }
}
