namespace Tdn.Models.DTOs;

/// <summary>Поле шаблона листа персонажа.</summary>
public class SnapshotTemplateFieldPostData
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public string Type { get; set; } = "scalar";
    public string? Formula { get; set; }
}
