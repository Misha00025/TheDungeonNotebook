using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tdn.Models.Commands;

public enum CharacterCommandType
{
    AddField,
    UpdateField,
    DeleteField,
    Unsupported
}

public class CharacterCommandTypeConverter : JsonConverter<CharacterCommandType>
{
    public override CharacterCommandType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var s = reader.GetString();
        return s switch
        {
            "AddField" => CharacterCommandType.AddField,
            "UpdateField" => CharacterCommandType.UpdateField,
            "DeleteField" => CharacterCommandType.DeleteField,
            _ => CharacterCommandType.Unsupported
        };
    }

    public override void Write(Utf8JsonWriter writer, CharacterCommandType value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.ToString());
}
