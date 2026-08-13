namespace Tdn.Models.DTOs;

public struct QuestPostData
{
    public string Header { get; set; }
    public string Description { get; set; }
    public List<string>? Reward { get; set; }
    public string? Status { get; set; }
    public List<ObjectivePostData>? Objectives { get; set; }
    public List<int>? AssignedCharacters { get; set; }
}
