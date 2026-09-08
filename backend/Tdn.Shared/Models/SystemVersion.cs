namespace Tdn.Shared.Models;

/// <summary>
/// Версия игровой системы. Содержит неизменяемый набор контента
/// (предметы, навыки, шаблоны персонажей) на конкретный момент.
/// </summary>
public class SystemVersion
{
    public string Id { get; set; } = "";

    public string SystemId { get; set; } = "";

    /// <summary>Семантическая версия, например "1.0.0".</summary>
    public string Version { get; set; } = "";

    public string? Name { get; set; }

    public string? Description { get; set; }

    public List<ContentItem> Content { get; set; } = new();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
