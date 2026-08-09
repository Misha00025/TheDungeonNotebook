namespace Tdn.Db.Entities;

public class CharacterLogEntryView
{
    public DateTime Timestamp { get; set; }
    public int ActorId { get; set; }
    public string ActionType { get; set; } = "";
    public Dictionary<string, object?> Details { get; set; } = new();
}
