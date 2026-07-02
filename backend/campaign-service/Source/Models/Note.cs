namespace Tdn.Models;

public class Note
{
    public int Id;
    public int GroupId;
    public int? CharacterId;
    public string Header = "";
    public string ShortDescription = "";
    public string? Body;
    public DateTime CreatedAt;
    public DateTime UpdatedAt;
    public List<string> Keywords { get; set; } = new();
}
