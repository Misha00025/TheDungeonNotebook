namespace Tdn.Models.DTOs;

/// <summary>Шаблон листа персонажа внутри снимка.</summary>
public class SnapshotCharacterTemplatePostData
{
    public List<SnapshotTemplateFieldPostData> Fields { get; set; } = new();
}
