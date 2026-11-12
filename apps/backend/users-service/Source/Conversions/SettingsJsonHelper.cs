using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace Tdn.Conversions;

public static class SettingsJsonHelper
{
    // Converts a JSON object (as JsonElement) into key -> BsonValue map.
    public static Dictionary<string, BsonValue> ToBsonMap(JsonElement obj)
    {
        var doc = BsonDocument.Parse(obj.GetRawText());
        return doc.ToDictionary(kvp => kvp.Name, kvp => kvp.Value);
    }

    // Converts a BsonValue map into a map whose values are plain .NET objects
    // suitable for ASP.NET JSON serialization (nested objects become
    // Dictionary<string, object?>, arrays become List<object?>, null -> null).
    public static Dictionary<string, object?> ToJsonMap(Dictionary<string, BsonValue> values)
    {
        var result = new Dictionary<string, object?>();
        foreach (var kv in values)
            result[kv.Key] = ToDotNet(kv.Value);
        return result;
    }

    private static object? ToDotNet(BsonValue v)
    {
        switch (v.BsonType)
        {
            case BsonType.Null:
                return null;
            case BsonType.Document:
                return ((BsonDocument)v).ToDictionary(
                    e => e.Name,
                    e => ToDotNet(e.Value));
            case BsonType.Array:
                return ((BsonArray)v).Select(ToDotNet).ToList();
            default:
                return BsonTypeMapper.MapToDotNetValue(v);
        }
    }
}
