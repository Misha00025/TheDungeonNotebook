namespace Tdn.Db.Entities;

/// <summary>
/// Версия игровой системы — ссылка на снимок контента в MongoDB.
/// </summary>
public class SystemVersionData
{
    public string Id { get; set; } = "";

    public string SystemId { get; set; } = "";

    public string Version { get; set; } = "";

    public string SnapshotId { get; set; } = "";

    public long CreatedAt { get; set; }
}
