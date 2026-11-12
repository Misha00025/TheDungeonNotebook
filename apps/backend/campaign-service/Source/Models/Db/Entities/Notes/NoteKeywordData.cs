namespace Tdn.Db.Entities;

public class NoteKeywordData
{
    public int NoteId { get; set; }
    public string Keyword { get; set; } = "";
    
    public NoteData? Note { get; set; }
}
