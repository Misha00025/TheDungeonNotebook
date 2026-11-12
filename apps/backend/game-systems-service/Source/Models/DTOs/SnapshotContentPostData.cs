namespace Tdn.Models.DTOs;

/// <summary>Контент снимка версии: предметы, навыки, шаблон персонажа.</summary>
public class SnapshotContentPostData
{
    public List<SnapshotContentItemPostData> Items { get; set; } = new();
    public List<SnapshotContentItemPostData> Skills { get; set; } = new();
    public SnapshotCharacterTemplatePostData? CharacterTemplate { get; set; }
}
