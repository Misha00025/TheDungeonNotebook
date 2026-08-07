using System.Text.Json;

namespace Tdn.Models.Commands;

public static class FieldCommandParser
{
    public static string? GetKey(JsonElement payload)
        => payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("key", out var k)
            ? k.GetString()
            : null;

    public static FieldCommandData? GetField(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("field", out var f)
            || f.ValueKind != JsonValueKind.Object)
            return null;

        return new FieldCommandData
        {
            Name = GetStr(f, "name"),
            Description = GetStr(f, "description"),
            Value = GetInt(f, "value"),
            MaxValue = GetInt(f, "maxValue"),
            Formula = GetStr(f, "formula"),
            ModifierFormula = GetStr(f, "modifierFormula")
        };
    }

    private static string? GetStr(JsonElement e, string prop)
        => e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static int? GetInt(JsonElement e, string prop)
        => e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    public static int? GetItemId(JsonElement payload)
        => payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("itemId", out var v)
           && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;
}
