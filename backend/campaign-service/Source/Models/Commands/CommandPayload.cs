namespace Tdn.Models.Commands;

public struct CommandPayload
{
    public string? Key { get; set; }
    public FieldCommandData? Field { get; set; }
}

public struct FieldCommandData
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? Value { get; set; }
    public int? MaxValue { get; set; }
    public string? Formula { get; set; }
    public string? ModifierFormula { get; set; }
}
