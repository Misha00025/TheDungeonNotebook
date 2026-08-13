namespace Tdn.Models.Commands;

public struct FieldCommandData
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? Value { get; set; }
    public int? MaxValue { get; set; }
    public string? Formula { get; set; }
    public string? ModifierFormula { get; set; }
}
