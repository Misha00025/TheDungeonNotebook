namespace Tdn.Models.DTOs;

public struct CharacterPatchData
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? OwnerId { get; set; }
    public Dictionary<string, FieldPatchData?>? Fields { get; set; }
}
