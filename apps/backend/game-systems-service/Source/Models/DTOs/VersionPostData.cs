namespace Tdn.Models.DTOs;

/// <summary>
/// Создание версии системы: семантическая версия + контент снимка.
/// </summary>
public struct VersionPostData
{
    public string Version { get; set; }
    public SnapshotContentPostData Content { get; set; }
}
