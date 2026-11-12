namespace Tdn.Models.DTOs;

public struct QuestPatchData
{
    public string? Header { get; set; }
    public string? Description { get; set; }
    public List<string>? Reward { get; set; }
    public string? Status { get; set; }
    public List<int>? AssignedCharacters { get; set; }
    public List<ObjectivePatchData>? Objectives { get; set; }
}
