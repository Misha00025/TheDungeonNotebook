namespace Tdn.Shared.Models;

/// <summary>
/// Игровая система (например, D&D 5e, Pathfinder 2e).
/// Агрегат верхнего уровня, которому принадлежат версии контента.
/// </summary>
public class GameSystem
{
    public string Id { get; set; } = "";

    public string Name { get; set; } = "";

    public string? Description { get; set; }

    public string? Icon { get; set; }

    public List<SystemVersion> Versions { get; set; } = new();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
