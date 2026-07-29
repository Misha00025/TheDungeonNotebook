namespace Tdn.Models;

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


