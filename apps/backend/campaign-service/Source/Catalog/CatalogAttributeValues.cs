using System.Text.Json;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public static class CatalogAttributeValues
{
    public static CatalogAttributeValue[] FilterReadable(IEnumerable<CatalogAttributeValue> values, CatalogAttributeSchema schema)
    {
        var known = schema.Definitions.Select(x => x.Id).ToHashSet();
        return values.Where(x => x is not null && known.Contains(x.AttributeId)).Select(Clone).ToArray();
    }

    public static CatalogContent FilterReadable(CatalogContent data, CatalogAttributeSchema schema) => data with { Attributes = FilterReadable(data.Attributes, schema) };

    public static CatalogContent ValidateContent(CatalogContent data, CatalogAttributeSchema schema, CatalogAttributeValue[]? oldValues)
    {
        var byId = schema.Definitions.ToDictionary(x => x.Id);
        var prior = (oldValues ?? []).Where(x => byId.ContainsKey(x.AttributeId)).GroupBy(x => x.Id).ToDictionary(x => x.Key, x => x.First());
        var ids = new HashSet<Guid>();
        var output = new List<CatalogAttributeValue>();
        foreach (var value in data.Attributes)
        {
            if (value is null || value.Id == Guid.Empty || value.AttributeId == Guid.Empty || value.Value.ValueKind == JsonValueKind.Undefined || !Enum.IsDefined(value.EditLevel) || !ids.Add(value.Id))
                throw BadRequest("invalid_attribute_value", "Occurrence IDs, values, and edit levels must be valid and unique.");
            if (!byId.TryGetValue(value.AttributeId, out var definition))
            {
                if (oldValues?.Any(x => x.Id == value.Id && x.AttributeId == value.AttributeId) == true) continue;
                throw BadRequest("unknown_attribute", "The attribute is unknown.");
            }
            if (prior.TryGetValue(value.Id, out var old) && IsExactlySame(old, value))
            {
                output.Add(Clone(value));
                continue;
            }
            if (!IsValueValid(definition, value.Value)) throw BadRequest("invalid_attribute_value", "The value is incompatible with the attribute type.");
            output.Add(Clone(value));
        }
        return data with { Attributes = output.ToArray() };
    }

    public static bool IsExactlySame(CatalogAttributeValue old, CatalogAttributeValue current) => old.Id == current.Id && old.AttributeId == current.AttributeId && old.EditLevel == current.EditLevel && JsonElement.DeepEquals(old.Value, current.Value);

    public static bool IsValueValid(CatalogAttributeDefinition definition, JsonElement value)
    {
        try
        {
            return definition.TypeKey switch
            {
                "integer" => value.ValueKind == JsonValueKind.Number && (value.TryGetInt64(out _) || value.TryGetDecimal(out var d) && decimal.Truncate(d) == d && d >= long.MinValue && d <= long.MaxValue),
                "number" => value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var n) && double.IsFinite(n),
                "string" => value.ValueKind == JsonValueKind.String,
                "boolean" => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
                "singleChoice" => value.ValueKind == JsonValueKind.String && definition.Options.Any(o => o.OptionKey == value.GetString()),
                "multiChoice" => IsMultiChoiceValid(definition, value),
                _ => false
            };
        }
        catch (InvalidOperationException) { return false; }
    }

    private static CatalogAttributeValue Clone(CatalogAttributeValue value) => value with { Value = value.Value.Clone() };
    private static bool IsMultiChoiceValid(CatalogAttributeDefinition definition, JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Array) return false;
        var allowed = definition.Options.Select(x => x.OptionKey).ToHashSet(StringComparer.Ordinal);
        var selected = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in value.EnumerateArray())
            if (item.ValueKind != JsonValueKind.String || item.GetString() is not { } key || !allowed.Contains(key) || !selected.Add(key)) return false;
        return true;
    }
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
}
