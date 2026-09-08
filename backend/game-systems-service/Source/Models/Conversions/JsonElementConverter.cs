using System.Text.Json;

namespace Tdn.Models.Conversions;

/// <summary>
/// Конвертация значений, пришедших из JSON-десериализации ASP.NET, в "плоские"
/// .NET-значения, которые умеет сериализовать MongoDB ObjectSerializer.
///
/// Проблема: DTO использует Dictionary&lt;string, object&gt;, и ASP.NET кладёт в
/// object значения типа System.Text.Json.JsonElement. MongoDB ObjectSerializer
/// не умеет сериализовать JsonElement при записи снимка (BsonSerializationException).
/// Этот конвертер рекурсивно превращает JsonElement в string/bool/long/double и
/// вложенные Dictionary/List.
/// </summary>
public static class JsonElementConverter
{
    /// <summary>
    /// Рекурсивно конвертирует словарь, значения которого могут быть JsonElement,
    /// в словарь с "плоскими" .NET-значениями. Возвращает null, если source == null.
    /// </summary>
    public static Dictionary<string, object>? ToPlain(Dictionary<string, object>? source)
    {
        if (source == null) return null;
        var result = new Dictionary<string, object>(source.Count);
        foreach (var (key, value) in source)
            result[key] = ToPlainValue(value);
        return result;
    }

    private static object ToPlainValue(object? value)
    {
        return value is JsonElement element ? FromJsonElement(element) : value!;
    }

    private static object FromJsonElement(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                var dict = new Dictionary<string, object>();
                foreach (var prop in element.EnumerateObject())
                    dict[prop.Name] = FromJsonElement(prop.Value);
                return dict;
            case JsonValueKind.Array:
                var list = new List<object>();
                foreach (var item in element.EnumerateArray())
                    list.Add(FromJsonElement(item));
                return list;
            case JsonValueKind.String:
                return element.GetString()!;
            case JsonValueKind.Number:
                if (element.TryGetInt64(out var l)) return l;
                if (element.TryGetDouble(out var d)) return d;
                return element.GetRawText();
            case JsonValueKind.True:
            case JsonValueKind.False:
                return element.GetBoolean();
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
                return null!;
            default:
                return element.GetRawText();
        }
    }
}
