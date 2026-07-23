namespace Tdn.Models;

public struct QuestPostData
{
    public string Header { get; set; }
    public string Description { get; set; }
    public List<string>? Reward { get; set; }
    public string? Status { get; set; }
    public List<ObjectivePostData>? Objectives { get; set; }
    public List<int>? AssignedCharacters { get; set; }
}

public struct ObjectivePostData
{
    public string Key { get; set; }
    public string Description { get; set; }
    public string? Status { get; set; }
}

public struct ObjectiveStatusPostData
{
    public string Status { get; set; }
}

public class Quest
{
    public int Id;
    public string Header = "";
    public string Description = "";
    public List<string> Reward = new();
    public string Status = "active";
    public Group Group { get; private set; }
    public List<Objective> Objectives = new();
    public List<int> AssignedCharacters = new();

    public Quest(Group group)
    {
        Group = group;
    }
}

public class Objective
{
    public string Key = "";
    public string Description = "";
    public string Status = "pending";
}

public struct QuestPatchData
{
    public string? Header { get; set; }
    public string? Description { get; set; }
    public List<string>? Reward { get; set; }
    public string? Status { get; set; }
    public List<int>? AssignedCharacters { get; set; }
    public List<ObjectivePatchData>? Objectives { get; set; }
}

public struct ObjectivePatchData
{
    public string Key { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
}
