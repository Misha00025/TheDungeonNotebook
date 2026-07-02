using Tdn.Db.Entities;

namespace Tdn.Db.Entities;

public class NoteData : GroupEntityData
{
    public int? CharacterId;
    public string Header = "";
    public string ShortDescription = "";
    public DateTime AdditionDate;
    public DateTime ModifyDate;

    public CharacterData? Character;
    
    public List<NoteKeywordData>? Keywords;
}
