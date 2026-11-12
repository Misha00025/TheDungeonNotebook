namespace Tdn.Shared.Models;

/// <summary>
/// Ссылка на снапшот версии игровой системы.
/// Используется сервисами-потребителями (например, campaign-service),
/// чтобы «закрепить» конкретную версию контента без копирования самих данных.
/// </summary>
public class SnapshotRef
{
    public string SystemId { get; set; } = "";

    public string VersionId { get; set; } = "";

    public string SnapshotId { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
