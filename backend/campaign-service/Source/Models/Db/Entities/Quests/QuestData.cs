using Tdn.Db.Entities;

namespace Tdn.Db.Entities;

public class QuestData : GroupEntityData
{
    public string Header { get; set; } = "";
    public string Status { get; set; } = "active";
}

public class QuestAssignmentData
{
    public int QuestId { get; set; }
    public int CharacterId { get; set; }
    public QuestData Quest { get; set; } = null!;
    public CharacterData Character { get; set; } = null!;
}
