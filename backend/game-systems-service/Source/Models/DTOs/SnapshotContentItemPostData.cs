namespace Tdn.Models.DTOs;

/// <summary>Элемент контента снимка (предмет / навык).</summary>
public class SnapshotContentItemPostData
{
    public string? Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public Dictionary<string, object>? Properties { get; set; }
    public int? Price { get; set; }
    public string? Rarity { get; set; }
}
