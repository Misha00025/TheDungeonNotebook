using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public sealed class CatalogService(CampaignService campaigns, ICatalogStore store, IContentStore content)
{
    private const string SchemaCollection = "catalogAttributeDefinitions";
    private const string ContentCollection = "catalogContents";

    public async Task<CatalogAttributeSchemaEnvelope> GetAttributesAsync(Subject? subject, int campaignId, CancellationToken ct)
    {
        await campaigns.GetAccessAsync(subject, campaignId, ct);
        return await ReadSchema(campaignId, ct);
    }

    public async Task<CatalogAttributeSchemaEnvelope> UpdateAttributesAsync(Subject? subject, int campaignId, CatalogAttributesUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        var expected = request.ExpectedRevision;
        if (expected is null || expected < 0 || request.Definitions is null) throw BadRequest("invalid_schema", "expectedRevision and definitions are required.");
        var current = await content.GetAsync<CatalogAttributeSchema>(SchemaCollection, campaignId, Guid.Empty, ct)
            ?? new ContentEnvelope<CatalogAttributeSchema>(campaignId, Guid.Empty, 0, new CatalogAttributeSchema([]));
        if (current.ContentRevision != expected) throw Conflict(campaignId, "content_revision_conflict");
        var definitions = BuildDefinitions(request.Definitions, current.Data.Definitions);
        var schema = new CatalogAttributeSchema(definitions);
        ContentEnvelope<CatalogAttributeSchema>? result;
        if (expected == 0)
        {
            try { result = await content.CreateAsync(SchemaCollection, campaignId, Guid.Empty, schema, ct); }
            catch (ContentAlreadyPreparedException) { throw Conflict(campaignId, "content_revision_conflict"); }
        }
        else result = await content.ReplaceAsync(SchemaCollection, campaignId, Guid.Empty, expected.Value, schema, ct);
        return result is null ? throw Conflict(campaignId, "content_revision_conflict") : new(campaignId, result.ContentRevision, result.Data);
    }

    public async Task<IReadOnlyList<CatalogEntryDto>> ListAsync(Subject? subject, int campaignId, CatalogKind? kind, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        if (kind is { } selectedKind && !Enum.IsDefined(selectedKind)) throw BadRequest("invalid_kind", "kind is unknown.");
        return (await store.ListAsync(campaignId, kind, ct)).Where(x => CanRead(access, x)).Select(ToDto).ToArray();
    }

    public async Task<CatalogEntryDto> GetAsync(Subject? subject, int campaignId, Guid id, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        var entry = await RequireEntry(campaignId, id, ct);
        if (!CanRead(access, entry)) throw NotFound();
        return ToDto(entry);
    }

    public async Task<CatalogCreateResult> CreateAsync(Subject? subject, int campaignId, CatalogCreateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        var id = request.RequestId is { } requestId && requestId != Guid.Empty ? requestId : throw BadRequest("invalid_request_id", "A non-empty requestId is required.");
        ValidateMetadata(request.Name, request.Kind, request.QuantityUnit, request.AllowNegative);
        if (request.IsHidden is null) throw BadRequest("invalid_metadata", "isHidden is required.");
        if (request.Description is null || request.Attributes is null) throw BadRequest("invalid_content", "description and attributes are required.");
        if (await store.GetAsync(campaignId, id, ct) is not null) throw AlreadyPublished(id);
        var schema = await ReadSchema(campaignId, ct);
        var data = ValidateContent(new CatalogContent(request.Description, request.Attributes), schema.Data, null);
        ContentEnvelope<CatalogContent> prepared;
        try { prepared = await content.CreateAsync(ContentCollection, campaignId, id, data, ct); }
        catch (ContentAlreadyPreparedException) { throw new DomainException(409, "content_already_prepared", "Content is already prepared for this resource.", id, id); }
        var entity = new CatalogEntry { Id = id, CampaignId = campaignId, Name = request.Name!, Kind = request.Kind!.Value, CreatorUserId = access.Subject.Type == SubjectType.User ? access.Subject.Id : null, IsHidden = request.IsHidden!.Value, QuantityUnit = request.QuantityUnit, AllowNegative = request.AllowNegative!.Value };
        try
        {
            var created = await store.CreateAsync(entity, ct);
            return new(ToDto(created), ToEnvelope(prepared, schema.ContentRevision));
        }
        catch (DuplicateResourceException) { throw AlreadyPublished(id); }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (exception is DbException or DbUpdateException or ResourceStoreException or CampaignStoreException)
        { throw new DomainException(503, "publication_outcome_unknown", "The metadata publication outcome could not be confirmed.", id, id); }
    }

    public async Task<CatalogEntryDto> UpdateMetadataAsync(Subject? subject, int campaignId, Guid id, CatalogMetadataUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        var entry = await RequireWritable(access, campaignId, id, ct);
        var expected = request.ExpectedRevision;
        if (expected is null || expected < 1) throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        var hidden = request.IsHidden ?? entry.IsHidden;
        if (!access.IsAdmin && hidden != entry.IsHidden) throw Forbidden();
        var unit = request.QuantityUnit ?? entry.QuantityUnit;
        var negative = request.AllowNegative ?? entry.AllowNegative;
        ValidateMetadata(request.Name, entry.Kind, unit, negative);
        if (!await store.UpdateAsync(campaignId, id, request.Name!, hidden, unit, negative, expected.Value, ct))
        {
            if (await store.GetAsync(campaignId, id, ct) is null) throw NotFound();
            throw Conflict(id, "revision_conflict");
        }
        return new(id, campaignId, request.Name!, entry.Kind, entry.CreatorUserId, hidden, unit, negative, expected.Value + 1);
    }

    public async Task<CatalogContentEnvelope> GetContentAsync(Subject? subject, int campaignId, Guid id, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        var entry = await RequireEntry(campaignId, id, ct);
        if (!CanRead(access, entry)) throw NotFound();
        var raw = await content.GetAsync<CatalogContent>(ContentCollection, campaignId, id, ct)
            ?? throw new DomainException(503, "content_unavailable", "The published content is unavailable.", id);
        var schema = await ReadSchema(campaignId, ct);
        return ToEnvelope(raw, schema.ContentRevision, Diagnose(raw.Data, schema.Data));
    }

    public async Task<CatalogContentEnvelope> UpdateContentAsync(Subject? subject, int campaignId, Guid id, CatalogContentUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        var entry = await RequireWritable(access, campaignId, id, ct);
        if (request.ExpectedRevision is not > 0 || request.Description is null || request.Attributes is null) throw BadRequest("invalid_content", "expectedRevision, description, and attributes are required.");
        var current = await content.GetAsync<CatalogContent>(ContentCollection, campaignId, id, ct)
            ?? throw new DomainException(503, "content_unavailable", "The published content is unavailable.", id);
        if (current.ContentRevision != request.ExpectedRevision) throw Conflict(id, "content_revision_conflict");
        var schema = await ReadSchema(campaignId, ct);
        var data = ValidateContent(new CatalogContent(request.Description, request.Attributes), schema.Data, current.Data.Attributes);
        var result = await content.ReplaceAsync(ContentCollection, campaignId, id, request.ExpectedRevision.Value, data, ct);
        return result is null ? throw Conflict(id, "content_revision_conflict") : ToEnvelope(result, schema.ContentRevision, Diagnose(result.Data, schema.Data));
    }

    private async Task<CatalogEntry> RequireWritable(CampaignAccess access, int campaignId, Guid id, CancellationToken ct)
    {
        var entry = await RequireEntry(campaignId, id, ct);
        if (CanRead(access, entry))
        {
            if (access.IsAdmin || access.Subject.Type == SubjectType.User && entry.CreatorUserId == access.Subject.Id) return entry;
            throw Forbidden();
        }
        throw NotFound();
    }

    private async Task<CatalogEntry> RequireEntry(int campaignId, Guid id, CancellationToken ct) => await store.GetAsync(campaignId, id, ct) ?? throw NotFound();
    private async Task<CatalogAttributeSchemaEnvelope> ReadSchema(int campaignId, CancellationToken ct)
    {
        var current = await content.GetAsync<CatalogAttributeSchema>(SchemaCollection, campaignId, Guid.Empty, ct);
        return current is null ? new(campaignId, 0, new CatalogAttributeSchema([])) : new(campaignId, current.ContentRevision, current.Data);
    }

    private static CatalogAttributeDefinition[] BuildDefinitions(CatalogAttributeDefinitionInput[] inputs, CatalogAttributeDefinition[] previous)
    {
        var old = previous.ToDictionary(x => x.Id);
        var seen = new HashSet<Guid>();
        var result = new List<CatalogAttributeDefinition>();
        foreach (var input in inputs)
        {
            if (input is null || string.IsNullOrWhiteSpace(input.Title) || string.IsNullOrWhiteSpace(input.TypeKey) || input.Options is null || input.IsActive is null) throw BadRequest("invalid_definition", "Definition fields are required.");
            var options = ValidateOptions(input.TypeKey, input.Options);
            var id = input.Id ?? Guid.NewGuid();
            if (id == Guid.Empty || !seen.Add(id)) throw BadRequest("invalid_definition_id", "Definition IDs must be non-empty and unique.");
            long revision = 1;
            if (input.Id is { } supplied)
            {
                if (!old.TryGetValue(supplied, out var prior)) throw BadRequest("unknown_attribute", "The definition ID is unknown.");
                var removed = prior.Options.Select(x => x.OptionKey).Except(options.Select(x => x.OptionKey), StringComparer.Ordinal).Any();
                revision = prior.TypeRevision + (prior.TypeKey != input.TypeKey || removed ? 1 : 0);
            }
            result.Add(new(id, input.Title, input.TypeKey, revision, options, input.IsActive.Value));
        }
        foreach (var prior in previous.Where(x => !seen.Contains(x.Id))) result.Add(prior with { IsActive = false });
        return result.ToArray();
    }

    private static ChoiceOption[] ValidateOptions(string type, ChoiceOption[] options)
    {
        if (type is not ("integer" or "number" or "string" or "boolean" or "singleChoice" or "multiChoice")) throw BadRequest("invalid_type_key", "typeKey is unknown.");
        if (type is not ("singleChoice" or "multiChoice") && options.Length != 0) throw BadRequest("invalid_options", "Options are only valid for choice types.");
        var keys = new HashSet<string>(StringComparer.Ordinal);
        if (options.Any(x => x is null || string.IsNullOrWhiteSpace(x.OptionKey) || x.Title is null || !keys.Add(x.OptionKey))) throw BadRequest("invalid_options", "Choice option keys must be unique and non-empty.");
        return options.ToArray();
    }

    private static CatalogContent ValidateContent(CatalogContent data, CatalogAttributeSchema schema, CatalogAttributeValue[]? oldValues)
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

    private static bool IsExactlySame(CatalogAttributeValue old, CatalogAttributeValue current) => old.Id == current.Id && old.AttributeId == current.AttributeId && old.TypeKey == current.TypeKey && old.TypeRevision == current.TypeRevision && old.EditLevel == current.EditLevel && JsonElement.DeepEquals(old.Value, current.Value);
    private static bool IsValueValid(CatalogAttributeDefinition definition, JsonElement value)
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

    private static bool IsMultiChoiceValid(CatalogAttributeDefinition definition, JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Array) return false;
        var allowed = definition.Options.Select(x => x.OptionKey).ToHashSet(StringComparer.Ordinal);
        var selected = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in value.EnumerateArray())
            if (item.ValueKind != JsonValueKind.String || item.GetString() is not { } key || !allowed.Contains(key) || !selected.Add(key)) return false;
        return true;
    }

    private static CatalogDiagnostic[] Diagnose(CatalogContent data, CatalogAttributeSchema schema)
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

    private static CatalogContentEnvelope ToEnvelope(ContentEnvelope<CatalogContent> content, long schemaRevision, CatalogDiagnostic[]? diagnostics = null) => new(content.CampaignId, content.ResourceId, content.ContentRevision, schemaRevision, content.Data, diagnostics ?? []);
    private static CatalogEntryDto ToDto(CatalogEntry x) => new(x.Id, x.CampaignId, x.Name, x.Kind, x.CreatorUserId, x.IsHidden, x.QuantityUnit, x.AllowNegative, x.MetadataRevision);
    private static bool CanRead(CampaignAccess access, CatalogEntry entry) => !entry.IsHidden || access.IsAdmin || access.Subject.Type == SubjectType.User && entry.CreatorUserId == access.Subject.Id;
    private static void ValidateMetadata(string? name, CatalogKind? kind, QuantityUnit? unit, bool? negative)
    {
        if (string.IsNullOrWhiteSpace(name)) throw BadRequest("invalid_name", "A non-whitespace name is required.");
        if (kind is null || !Enum.IsDefined(kind.Value)) throw BadRequest("invalid_kind", "kind is required and must be known.");
        if (negative is null) throw BadRequest("invalid_metadata", "allowNegative is required.");
        if (kind == CatalogKind.Item && (unit is null || !Enum.IsDefined(unit.Value))) throw BadRequest("invalid_quantity_unit", "Items require a known quantityUnit.");
        if (kind == CatalogKind.Skill && (unit is not null || negative.Value)) throw BadRequest("invalid_quantity_unit", "Skills require quantityUnit=null and allowNegative=false.");
    }
    private static void EnsureAdmin(CampaignAccess access) { if (!access.IsAdmin) throw Forbidden(); }
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException Forbidden() => new(403, "forbidden", "The operation is not permitted.");
    private static DomainException NotFound() => new(404, "not_found", "The requested resource was not found.");
    private static DomainException Conflict(object id, string code) => new(409, code, "The resource revision no longer matches.", id);
    private static DomainException AlreadyPublished(Guid id) => new(409, "already_published", "The resource has already been published.", id, id);
}
