using System.Text.Json;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public static class CatalogAttributeValues
{
    public static CatalogContent ValidateContent(CatalogContent data, CatalogAttributeSchema schema, CatalogAttributeValue[]? oldValues)
    {
        var byId = schema.Definitions.ToDictionary(x => x.Id);
        var prior = (oldValues ?? []).ToDictionary(x => x.Id);
        var ids = new HashSet<Guid>();
        foreach (var value in data.Attributes)
        {
            if (value is null || value.Id == Guid.Empty || value.AttributeId == Guid.Empty || string.IsNullOrWhiteSpace(value.TypeKey) || value.TypeRevision < 1 || value.Value.ValueKind == JsonValueKind.Undefined || !Enum.IsDefined(value.EditLevel) || !ids.Add(value.Id)) throw BadRequest("invalid_attribute_value", "Occurrence IDs, type, revision, value, and edit level must be valid and unique.");
            if (prior.TryGetValue(value.Id, out var old) && IsExactlySame(old, value)) continue;
            if (!byId.TryGetValue(value.AttributeId, out var definition)) throw BadRequest("unknown_attribute", "The attribute is unknown.");
            var existingBinding = prior.TryGetValue(value.Id, out old) && old.AttributeId == value.AttributeId;
            if (!definition.IsActive && !existingBinding) throw BadRequest("inactive_attribute", "A new occurrence cannot use an inactive attribute.");
            if (value.TypeKey != definition.TypeKey || value.TypeRevision != definition.TypeRevision) throw BadRequest("incompatible_attribute_type", "The occurrence type does not match the current definition.");
            if (!IsValueValid(definition, value.Value)) throw BadRequest("invalid_attribute_value", "The value is incompatible with the attribute type.");
        }
        return data with { Attributes = data.Attributes.Select(x => x with { Value = x.Value.Clone() }).ToArray() };
    }

    public static bool IsExactlySame(CatalogAttributeValue old, CatalogAttributeValue current) => old.Id == current.Id && old.AttributeId == current.AttributeId && old.TypeKey == current.TypeKey && old.TypeRevision == current.TypeRevision && old.EditLevel == current.EditLevel && JsonElement.DeepEquals(old.Value, current.Value);

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

    public static CatalogDiagnostic[] Diagnose(CatalogContent data, CatalogAttributeSchema schema)
    {
        var definitions = schema.Definitions.ToDictionary(x => x.Id);
        var output = new List<CatalogDiagnostic>();
        foreach (var value in data.Attributes)
        {
            if (!definitions.TryGetValue(value.AttributeId, out var definition)) output.Add(new(value.Id, "unknown_attribute"));
            else if (value.TypeKey != definition.TypeKey || value.TypeRevision != definition.TypeRevision) output.Add(new(value.Id, "incompatible_attribute_type"));
            else if (!IsValueValid(definition, value.Value)) output.Add(new(value.Id, "invalid_attribute_value"));
        }
        return output.ToArray();
    }

    public static bool SameSet(IReadOnlyList<CatalogAttributeValue> left, IReadOnlyList<CatalogAttributeValue> right)
    {
        if (left.Count != right.Count || left.Select(x => x.Id).Distinct().Count() != left.Count || right.Select(x => x.Id).Distinct().Count() != right.Count) return false;
        return left.All(value => right.Any(candidate => candidate.Id == value.Id && IsExactlySame(value, candidate)));
    }

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
