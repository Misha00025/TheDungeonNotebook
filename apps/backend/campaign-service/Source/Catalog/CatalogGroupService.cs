using System.Text.Json;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public sealed class CatalogGroupService<TCatalog>(CampaignService campaigns, CatalogService<TCatalog> catalog, ICatalogStore<TCatalog> entries, IContentStore content) where TCatalog : ICatalogType
{
    private static string Collection => TCatalog.GroupsCollection;

    public async Task<CatalogGroupsEnvelope> ListAsync(Subject? subject, int campaignId, CancellationToken ct)
    {
        await campaigns.GetAccessAsync(subject, campaignId, ct);
        var current = await ReadConfiguration(campaignId, ct);
        var groups = current.Data.Groups.Select(x => new CatalogGroupSummary(x.Id, x.Title, x.ParentId)).ToArray();
        return new(campaignId, current.ContentRevision, groups);
    }

    public async Task<CatalogGroupConfigurationEnvelope> GetConfigurationAsync(Subject? subject, int campaignId, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        var current = await ReadConfiguration(campaignId, ct);
        var schema = await catalog.GetAttributesAsync(subject, campaignId, ct);
        return ToEnvelope(campaignId, current, schema.Data);
    }

    public async Task<CatalogGroupConfigurationEnvelope> UpdateConfigurationAsync(Subject? subject, int campaignId, CatalogGroupsUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        if (request.ExpectedRevision is null || request.ExpectedRevision < 0) throw BadRequest("invalid_revision", "expectedRevision must be nonnegative.");
        var current = await ReadConfiguration(campaignId, ct);
        if (current.ContentRevision != request.ExpectedRevision.Value) throw Conflict(campaignId);
        if (request.Groups is null) throw BadRequest("invalid_groups", "groups is required.");
        var schema = await catalog.GetAttributesAsync(subject, campaignId, ct);
        var groups = await BuildGroups(campaignId, request.Groups, current.Data.Groups, schema.Data, ct);
        var configuration = new CatalogGroupConfiguration(groups);
        ContentEnvelope<CatalogGroupConfiguration>? result;
        if (request.ExpectedRevision.Value == 0)
        {
            try { result = await content.CreateAsync(Collection, campaignId, Guid.Empty, configuration, ct); }
            catch (ContentAlreadyPreparedException) { throw Conflict(campaignId); }
        }
        else result = await content.ReplaceAsync(Collection, campaignId, Guid.Empty, request.ExpectedRevision.Value, configuration, ct);
        if (result is null) throw Conflict(campaignId);
        return ToEnvelope(campaignId, result, schema.Data);
    }

    public async Task<CatalogGroupEntriesEnvelope> GetEntriesAsync(Subject? subject, int campaignId, Guid groupId, CancellationToken ct)
    {
        await campaigns.GetAccessAsync(subject, campaignId, ct);
        var current = await ReadConfiguration(campaignId, ct);
        var group = current.Data.Groups.SingleOrDefault(x => x.Id == groupId) ?? throw NotFound(groupId);
        var schema = await catalog.GetAttributesAsync(subject, campaignId, ct);
        var readableCondition = HasUnknownBinding(group.Condition, schema.Data) ? null : group.Condition;
        IReadOnlyList<string> groupIssues = readableCondition is null ? Array.Empty<string>() : AnalyzeCondition(readableCondition, schema.Data);
        var diagnostics = new List<CatalogGroupDiagnostic>();
        var diagnosticKeys = new HashSet<(Guid GroupId, Guid? EntryId, string Code)>();
        foreach (var code in groupIssues)
            AddDiagnostic(diagnostics, diagnosticKeys, new CatalogGroupDiagnostic(group.Id, null, code));

        var visibleEntries = await catalog.ListAsync(subject, campaignId, ct);
        var explicitIds = group.EntryIds.ToHashSet();
        var canEvaluateCondition = readableCondition is not null && groupIssues.Count == 0;
        var candidates = canEvaluateCondition
            ? visibleEntries
            : visibleEntries.Where(x => explicitIds.Contains(x.Id)).ToArray();
        var resultIds = visibleEntries.Where(x => explicitIds.Contains(x.Id)).Select(x => x.Id).ToHashSet();

        foreach (var entry in candidates)
        {
            var contentEnvelope = await catalog.GetContentAsync(subject, campaignId, entry.Id, ct);
            if (!canEvaluateCondition) continue;
            var entryIssues = GetEntryConditionIssues(readableCondition!, contentEnvelope.Data, schema.Data);
            if (entryIssues.Length > 0)
            {
                foreach (var issue in entryIssues)
                    AddDiagnostic(diagnostics, diagnosticKeys, new CatalogGroupDiagnostic(group.Id, entry.Id, issue));
                continue;
            }
            if (Evaluate(readableCondition!, contentEnvelope.Data.Attributes, schema.Data)) resultIds.Add(entry.Id);
        }

        var result = visibleEntries.Where(x => resultIds.Contains(x.Id))
            .OrderBy(x => x.Name, StringComparer.Ordinal)
            .ThenBy(x => x.Id)
            .ToArray();
        return new(campaignId, group.Id, current.ContentRevision, result, diagnostics.ToArray());
    }

    private async Task<CatalogGroup[]> BuildGroups(int campaignId, CatalogGroupInput[] inputs, CatalogGroup[] previous, CatalogAttributeSchema schema, CancellationToken ct)
    {
        var previousById = previous.ToDictionary(x => x.Id);
        var ids = new HashSet<Guid>();
        var result = new List<CatalogGroup>(inputs.Length);
        foreach (var input in inputs)
        {
            if (input is null || string.IsNullOrWhiteSpace(input.Title) || input.EntryIds is null)
                throw BadRequest("invalid_group", "Each group requires a non-whitespace title and entryIds array.");
            Guid id;
            if (input.Id is { } supplied)
            {
                if (supplied == Guid.Empty) throw BadRequest("invalid_group_id", "Group IDs must be non-empty.");
                if (!previousById.ContainsKey(supplied)) throw BadRequest("unknown_group", "A supplied group ID is not in the current configuration.");
                id = supplied;
            }
            else
            {
                id = Guid.NewGuid();
                while (previousById.ContainsKey(id) || ids.Contains(id)) id = Guid.NewGuid();
            }
            if (!ids.Add(id)) throw BadRequest("duplicate_group_id", "Group IDs must be unique.");
            if (input.EntryIds.Any(x => x == Guid.Empty) || input.EntryIds.Distinct().Count() != input.EntryIds.Length)
                throw BadRequest("invalid_group_entries", "Explicit entry IDs must be non-empty and unique within a group.");
            foreach (var entryId in input.EntryIds)
                if (await entries.GetAsync(campaignId, entryId, ct) is null)
                    throw BadRequest("unknown_catalog_entry", "An explicit catalog entry does not exist in this campaign.");

            CatalogGroupCondition? previousCondition = null;
            if (input.Id is { } existingId && previousById.TryGetValue(existingId, out var oldGroup)) previousCondition = oldGroup.Condition;
            var condition = input.Condition;
            if (condition is not null && HasUnknownBinding(condition, schema))
            {
                var previousAttributeIds = CollectConditionAttributeIds(previousCondition);
                var unknownIds = CollectConditionAttributeIds(condition).Where(id => schema.Definitions.All(x => x.Id != id)).ToArray();
                if (unknownIds.Any(id => !previousAttributeIds.Contains(id))) throw BadRequest("invalid_group_condition", "A new condition cannot reference an unknown attribute.");
                condition = null;
            }
            var unchangedCondition = ConditionsEqual(previousCondition, condition);
            if (condition is not null && !unchangedCondition)
            {
                if (AnalyzeCondition(condition, schema).Count > 0)
                    throw BadRequest("invalid_group_condition", "The condition shape or a referenced attribute is invalid for the current schema.");
            }
            result.Add(new CatalogGroup(id, input.Title, input.ParentId, input.EntryIds.ToArray(), condition));
        }
        ValidateParents(result);
        return result.ToArray();
    }

    private static void ValidateParents(IReadOnlyList<CatalogGroup> groups)
    {
        var byId = groups.ToDictionary(x => x.Id);
        foreach (var group in groups)
        {
            if (group.ParentId is not { } parentId) continue;
            if (parentId == Guid.Empty || !byId.ContainsKey(parentId)) throw BadRequest("invalid_group_parent", "Every parentId must refer to a group in this configuration.");
            if (parentId == group.Id) throw BadRequest("invalid_group_parent", "A group cannot be its own parent.");
        }

        var complete = new HashSet<Guid>();
        foreach (var group in groups)
        {
            if (complete.Contains(group.Id)) continue;
            var path = new List<Guid>();
            var active = new HashSet<Guid>();
            Guid? current = group.Id;
            while (current is { } currentId)
            {
                if (complete.Contains(currentId)) break;
                if (!active.Add(currentId)) throw BadRequest("group_hierarchy_cycle", "Group parent relationships cannot contain cycles.");
                path.Add(currentId);
                current = byId[currentId].ParentId;
            }
            foreach (var id in path) complete.Add(id);
        }
    }

    private static IReadOnlyList<string> AnalyzeCondition(CatalogGroupCondition condition, CatalogAttributeSchema schema)
    {
        var diagnostics = new List<string>();
        AnalyzeNode(condition, schema, diagnostics);
        return diagnostics.Distinct(StringComparer.Ordinal).ToArray();
    }

    private static void AnalyzeNode(CatalogGroupCondition? condition, CatalogAttributeSchema schema, List<string> diagnostics)
    {
        if (condition is null)
        {
            diagnostics.Add("invalid_condition");
            return;
        }

        switch (condition.Operator)
        {
            case "all":
            case "any":
                if (!HasNoLeafProperties(condition) || condition.Children is not { Length: > 0 }) diagnostics.Add("invalid_condition");
                if (condition.Children is not null)
                    foreach (var child in condition.Children) AnalyzeNode(child, schema, diagnostics);
                return;
            case "not":
                if (!HasNoLeafProperties(condition) || condition.Children is not { Length: 1 }) diagnostics.Add("invalid_condition");
                if (condition.Children is not null)
                    foreach (var child in condition.Children) AnalyzeNode(child, schema, diagnostics);
                return;
            case "exists":
                if (condition.AttributeId is not { } existsId || existsId == Guid.Empty || condition.Value.ValueKind != JsonValueKind.Undefined || condition.Children is not null)
                {
                    diagnostics.Add("invalid_condition");
                    return;
                }
                if (!TryGetDefinition(schema, existsId, diagnostics, out _)) return;
                return;
            case "eq":
            case "gt":
            case "gte":
            case "lt":
            case "lte":
            case "contains":
                if (condition.AttributeId is not { } attributeId || attributeId == Guid.Empty || condition.Value.ValueKind == JsonValueKind.Undefined || condition.Children is not null)
                {
                    diagnostics.Add("invalid_condition");
                    return;
                }
                if (!TryGetDefinition(schema, attributeId, diagnostics, out var definition)) return;
                if (condition.Operator == "contains")
                {
                    if (definition.TypeKey is not ("string" or "multiChoice"))
                    {
                        diagnostics.Add("incompatible_attribute_type");
                        return;
                    }
                    if (condition.Value.ValueKind != JsonValueKind.String ||
                        definition.TypeKey == "multiChoice" && !definition.Options.Any(option => string.Equals(option.OptionKey, condition.Value.GetString(), StringComparison.Ordinal)))
                        diagnostics.Add("invalid_attribute_value");
                    return;
                }
                if ((condition.Operator is "gt" or "gte" or "lt" or "lte") && definition.TypeKey is not ("integer" or "number"))
                {
                    diagnostics.Add("incompatible_attribute_type");
                    return;
                }
                if (!CatalogAttributeValues.IsValueValid(definition, condition.Value)) diagnostics.Add("invalid_attribute_value");
                return;
            default:
                diagnostics.Add("invalid_condition");
                if (condition.Children is not null)
                    foreach (var child in condition.Children) AnalyzeNode(child, schema, diagnostics);
                return;
        }
    }

    private static bool TryGetDefinition(CatalogAttributeSchema schema, Guid id, List<string> diagnostics, out CatalogAttributeDefinition definition)
    {
        var found = schema.Definitions.SingleOrDefault(x => x.Id == id);
        if (found is null)
        {
            diagnostics.Add("unknown_attribute");
            definition = null!;
            return false;
        }
        definition = found;
        return true;
    }

    private static HashSet<Guid> CollectConditionAttributeIds(CatalogGroupCondition? condition)
    {
        var ids = new HashSet<Guid>();
        if (condition is null) return ids;
        var pending = new Stack<CatalogGroupCondition>();
        pending.Push(condition);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (current.AttributeId is { } id) ids.Add(id);
            if (current.Children is null) continue;
            foreach (var child in current.Children)
                if (child is not null) pending.Push(child);
        }
        return ids;
    }

    private static bool HasNoLeafProperties(CatalogGroupCondition condition) =>
        condition.AttributeId is null && condition.Value.ValueKind == JsonValueKind.Undefined;

    private static bool ConditionsEqual(CatalogGroupCondition? left, CatalogGroupCondition? right)
    {
        if (left is null || right is null) return left is null && right is null;
        if (!string.Equals(left.Operator, right.Operator, StringComparison.Ordinal) || left.AttributeId != right.AttributeId || !JsonValuesEqual(left.Value, right.Value)) return false;
        if (left.Children is null || right.Children is null) return left.Children is null && right.Children is null;
        return left.Children.Length == right.Children.Length && left.Children.Zip(right.Children).All(pair => ConditionsEqual(pair.First, pair.Second));
    }

    private static bool JsonValuesEqual(JsonElement left, JsonElement right)
    {
        if (left.ValueKind == JsonValueKind.Undefined || right.ValueKind == JsonValueKind.Undefined)
            return left.ValueKind == JsonValueKind.Undefined && right.ValueKind == JsonValueKind.Undefined;
        return JsonElement.DeepEquals(left, right);
    }

    private static bool Evaluate(CatalogGroupCondition condition, CatalogAttributeValue[] values, CatalogAttributeSchema schema) => condition.Operator switch
    {
        "all" => condition.Children!.All(child => Evaluate(child, values, schema)),
        "any" => condition.Children!.Any(child => Evaluate(child, values, schema)),
        "not" => !Evaluate(condition.Children![0], values, schema),
        "exists" => values.Any(x => x.AttributeId == condition.AttributeId),
        "eq" => values.Where(x => x.AttributeId == condition.AttributeId).Any(x => JsonElement.DeepEquals(x.Value, condition.Value)),
        "contains" => values.Where(x => x.AttributeId == condition.AttributeId).Any(x => ContainsValue(x.Value, condition.Value.GetString()!)),
        "gt" => CompareValues(values, condition, schema, comparison => comparison > 0),
        "gte" => CompareValues(values, condition, schema, comparison => comparison >= 0),
        "lt" => CompareValues(values, condition, schema, comparison => comparison < 0),
        "lte" => CompareValues(values, condition, schema, comparison => comparison <= 0),
        _ => false
    };

    private static bool ContainsValue(JsonElement value, string needle) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString()!.Contains(needle, StringComparison.Ordinal),
        JsonValueKind.Array => value.EnumerateArray().Any(item => item.ValueKind == JsonValueKind.String && string.Equals(item.GetString(), needle, StringComparison.Ordinal)),
        _ => false
    };

    private static bool CompareValues(CatalogAttributeValue[] values, CatalogGroupCondition condition, CatalogAttributeSchema schema, Func<int, bool> predicate) =>
        values.Where(x => x.AttributeId == condition.AttributeId).Any(x => predicate(CompareNumbers(x.Value, condition.Value, schema.Definitions.Single(d => d.Id == condition.AttributeId).TypeKey)));

    private static int CompareNumbers(JsonElement left, JsonElement right, string typeKey)
    {
        if (typeKey == "integer")
        {
            if (left.TryGetInt64(out var leftInteger) && right.TryGetInt64(out var rightInteger)) return leftInteger.CompareTo(rightInteger);
            if (left.TryGetDecimal(out var leftDecimal) && right.TryGetDecimal(out var rightDecimal)) return decimal.Compare(leftDecimal, rightDecimal);
            throw new InvalidOperationException();
        }
        if (left.TryGetDecimal(out var leftNumber) && right.TryGetDecimal(out var rightNumber)) return decimal.Compare(leftNumber, rightNumber);
        if (left.TryGetDouble(out var leftDouble) && right.TryGetDouble(out var rightDouble)) return leftDouble.CompareTo(rightDouble);
        throw new InvalidOperationException();
    }

    private static string[] GetEntryConditionIssues(CatalogGroupCondition condition, CatalogContent content, CatalogAttributeSchema schema)
    {
        var diagnostics = new HashSet<string>(StringComparer.Ordinal);
        foreach (var attributeId in TypedAttributeIds(condition).Distinct())
        {
            var definition = schema.Definitions.Single(x => x.Id == attributeId);
            foreach (var occurrence in content.Attributes.Where(x => x.AttributeId == attributeId))
            {
                if (occurrence.Id == Guid.Empty || !Enum.IsDefined(occurrence.EditLevel)) diagnostics.Add("invalid_attribute_value");
                else if (!CatalogAttributeValues.IsValueValid(definition, occurrence.Value)) diagnostics.Add("invalid_attribute_value");
            }
        }
        return diagnostics.ToArray();
    }

    private static IEnumerable<Guid> TypedAttributeIds(CatalogGroupCondition condition)
    {
        if ((condition.Operator is "eq" or "gt" or "gte" or "lt" or "lte" or "contains") && condition.AttributeId is { } id)
            yield return id;
        if (condition.Children is not null)
            foreach (var child in condition.Children)
                if (child is not null)
                    foreach (var nestedId in TypedAttributeIds(child)) yield return nestedId;
    }

    private async Task<ContentEnvelope<CatalogGroupConfiguration>> ReadConfiguration(int campaignId, CancellationToken ct) =>
        await content.GetAsync<CatalogGroupConfiguration>(Collection, campaignId, Guid.Empty, ct)
        ?? new ContentEnvelope<CatalogGroupConfiguration>(campaignId, Guid.Empty, 0, new CatalogGroupConfiguration([]));

    private static CatalogGroupConfigurationEnvelope ToEnvelope(int campaignId, ContentEnvelope<CatalogGroupConfiguration> current, CatalogAttributeSchema schema)
    {
        var data = new CatalogGroupConfiguration(current.Data.Groups.Select(group => group with { Condition = HasUnknownBinding(group.Condition, schema) ? null : group.Condition }).ToArray());
        var diagnostics = data.Groups.SelectMany(group => group.Condition is null
                ? Enumerable.Empty<CatalogGroupDiagnostic>()
                : AnalyzeCondition(group.Condition, schema).Select(code => new CatalogGroupDiagnostic(group.Id, null, code)))
            .ToArray();
        return new CatalogGroupConfigurationEnvelope(campaignId, current.ContentRevision, data, diagnostics);
    }

    private static bool HasUnknownBinding(CatalogGroupCondition? condition, CatalogAttributeSchema schema) => condition is not null && CollectConditionAttributeIds(condition).Any(id => schema.Definitions.All(x => x.Id != id));

    private static void AddDiagnostic(List<CatalogGroupDiagnostic> diagnostics, HashSet<(Guid GroupId, Guid? EntryId, string Code)> seen, CatalogGroupDiagnostic diagnostic)
    {
        if (seen.Add((diagnostic.GroupId, diagnostic.EntryId, diagnostic.Code))) diagnostics.Add(diagnostic);
    }

    private static void EnsureAdmin(CampaignAccess access)
    {
        if (!access.IsAdmin) throw new DomainException(403, "forbidden", "The operation is not permitted.");
    }

    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException NotFound(Guid id) => new(404, "not_found", "The requested resource was not found.", id);
    private static DomainException Conflict(int campaignId) => new(409, "content_revision_conflict", "The group configuration revision no longer matches.", campaignId);
}
