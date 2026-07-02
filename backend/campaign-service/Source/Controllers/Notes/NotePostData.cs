using System.Text.Json.Serialization;

namespace Tdn.Api.Controllers;

public struct NotePostData
{
    public string Header { get; set; }

    [JsonPropertyName("short_description")]
    public string? ShortDescription { get; set; }

    public string? Body { get; set; }
    
    public List<string>? Keywords { get; set; }
}
