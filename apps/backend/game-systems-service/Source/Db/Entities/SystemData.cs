namespace Tdn.Db.Entities;

/// <summary>
/// Игровая система (метаданные). Хранится в MySQL.
/// </summary>
public class SystemData
{
    public string Id { get; set; } = "";

    public string Name { get; set; } = "";

    public string? Description { get; set; }

    public string? Icon { get; set; }

    public long CreatedAt { get; set; }

    public long UpdatedAt { get; set; }
}
