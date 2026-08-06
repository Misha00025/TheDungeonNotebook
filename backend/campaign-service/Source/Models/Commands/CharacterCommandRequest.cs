using System.Text.Json.Serialization;

namespace Tdn.Models.Commands;

public struct CharacterCommandRequest
{
    [JsonConverter(typeof(CharacterCommandTypeConverter))]
    public CharacterCommandType Type { get; set; }
    public CommandPayload? Payload { get; set; }
    public string? IdempotencyKey { get; set; }
}
