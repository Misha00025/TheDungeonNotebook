using System.Text.Json;

namespace Tdn.Models.Commands;

public struct CharacterCommandRequest
{
    public string Type { get; set; }
    public JsonElement? Payload { get; set; }
    public string? IdempotencyKey { get; set; }
}
