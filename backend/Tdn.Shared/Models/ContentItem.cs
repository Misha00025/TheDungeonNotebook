namespace Tdn.Shared.Models;

/// <summary>
/// Тип контента игровой системы.
/// </summary>
public enum ContentType
{
    Item,
    Skill,
    CharacterTemplate
}

/// <summary>
/// Элемент контента версии игровой системы.
/// Тип задаётся полем <see cref="Type"/>; полезная нагрузка лежит в <see cref="Data"/>.
/// </summary>
public class ContentItem
{
    public string Id { get; set; } = "";

    public ContentType Type { get; set; }

    public string Name { get; set; } = "";

    public string? Description { get; set; }

    /// <summary>Типизированная полезная нагрузка (Item / Skill / CharacterTemplate).</summary>
    public object? Data { get; set; }
}
