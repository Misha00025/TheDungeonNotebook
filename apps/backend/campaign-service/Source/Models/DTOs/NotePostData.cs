namespace Tdn.Models.DTOs;

public struct NotePostData
{
    public string Header { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("short_description")]
    public string? ShortDescription { get; set; }

    public string? Body { get; set; }

    public List<string>? Keywords { get; set; }
}
