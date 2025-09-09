using Tdn.Db.Entities;

public static class DataConversion
{
    public static IEnumerable<Dictionary<string, object?>> AsResult(this IEnumerable<NoteData> notes)
    {
        return notes.Select(e => e.AsResult());
    }
    
    public static Dictionary<string, object?> AsResult(this NoteData note)
    {
        var result = new Dictionary<string, object?>()
        {
            {"id", note.NoteId},
            {"header", note.Header},
            {"body", note.Body},
            {"created_at", note.AdditionDate},
            {"updated_at", note.ModifyDate}            
        };
        if (note.GetType().IsSubclassOf(typeof(GroupNoteData)) || note is GroupNoteData)
            result.Add("group_id", (note as GroupNoteData)?.GroupId);
        if (note is CharacterNoteData)
            result.Add("character_id", (note as CharacterNoteData)?.CharacterId);
        return result;
    }
}