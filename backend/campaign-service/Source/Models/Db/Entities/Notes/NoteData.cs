using Tdn.Db.Entities;

namespace Tdn.Db.Entities;

public class NoteData : GroupEntityData
{
    public int? CharacterId { get; set; }
    public string Header { get; set; } = "";
    public string ShortDescription { get; set; } = "";
    public DateTime AdditionDate { get; set; }
    public DateTime ModifyDate { get; set; }

    public CharacterData? Character { get; set; }
    
    public List<NoteKeywordData>? Keywords { get; set; }
}
