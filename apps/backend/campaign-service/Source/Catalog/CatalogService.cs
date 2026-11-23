using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public sealed class CatalogService<TCatalog>(CampaignService campaigns, ICatalogStore<TCatalog> store, IContentStore content, ICharacterCatalogStore<TCatalog> characterCatalog) where TCatalog : ICatalogType
{
    private static string SchemaCollection => TCatalog.AttributeDefinitionsCollection;
    private static string ContentCollection => TCatalog.ContentsCollection;

    public async Task<CatalogAttributeSchemaEnvelope> GetAttributesAsync(Subject? subject, int campaignId, CancellationToken ct)
    {
        await campaigns.GetAccessAsync(subject, campaignId, ct);
        return await ReadSchema(campaignId, ct);
    }

    public async Task<CatalogAttributeSchemaEnvelope> UpdateAttributesAsync(Subject? subject, int campaignId, CatalogAttributesUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        if (request.ExpectedRevision is null || request.ExpectedRevision < 0 || request.Definitions is null) throw BadRequest("invalid_schema", "expectedRevision and definitions are required.");
        var current = await ReadRawSchema(campaignId, ct);
        if (current.ContentRevision != request.ExpectedRevision) throw Conflict(campaignId, "content_revision_conflict");
        var schema = new CatalogAttributeSchema(BuildDefinitions(request.Definitions, current.Data.Definitions));
        ContentEnvelope<CatalogAttributeSchema>? result;
        if (request.ExpectedRevision == 0)
        {
            try { result = await content.CreateAsync(SchemaCollection, campaignId, Guid.Empty, schema, ct); }
            catch (ContentAlreadyPreparedException) { throw Conflict(campaignId, "content_revision_conflict"); }
        }
        else result = await content.ReplaceAsync(SchemaCollection, campaignId, Guid.Empty, request.ExpectedRevision.Value, schema, ct);
        return result is null ? throw Conflict(campaignId, "content_revision_conflict") : new(campaignId, result.ContentRevision, result.Data);
    }

    public async Task<CatalogAttributeSchemaEnvelope> DeleteAttributeAsync(Subject? subject, int campaignId, Guid attributeId, long expectedRevision, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        if (expectedRevision < 1) throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        var current = await ReadRawSchema(campaignId, ct);
        if (current.ContentRevision != expectedRevision) throw Conflict(campaignId, "content_revision_conflict");
        if (!current.Data.Definitions.Any(x => x.Id == attributeId)) throw new DomainException(404, "not_found", "The requested attribute was not found.", attributeId);
        var replacement = new CatalogAttributeSchema(current.Data.Definitions.Where(x => x.Id != attributeId).ToArray());
        var result = await content.ReplaceAsync(SchemaCollection, campaignId, Guid.Empty, expectedRevision, replacement, ct);
        return result is null ? throw Conflict(campaignId, "content_revision_conflict") : new(campaignId, result.ContentRevision, result.Data);
    }

    public async Task<IReadOnlyList<CatalogEntryDto>> ListAsync(Subject? subject, int campaignId, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        return (await store.ListAsync(campaignId, ct)).Where(x => CanRead(access, x)).Select(ToDto).ToArray();
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
        var id = RequireRequestId(request.RequestId);
        var metadata = ValidateMetadata(request.Name, request.QuantityUnit, request.AllowNegative);
        if (request.IsHidden is null || request.Description is null || request.Attributes is null) throw BadRequest("invalid_content", "Required fields are missing.");
        if (await store.GetAsync(campaignId, id, ct) is not null) throw AlreadyPublished(id);
        var schema = await ReadSchema(campaignId, ct);
        var data = CatalogAttributeValues.ValidateContent(new CatalogContent(request.Description, request.Attributes), schema.Data, null);
        ContentEnvelope<CatalogContent> prepared;
        try { prepared = await content.CreateAsync(ContentCollection, campaignId, id, data, ct); }
        catch (ContentAlreadyPreparedException) { throw new DomainException(409, "content_already_prepared", "Content for this resource is already prepared.", id, id); }
        var entity = new CatalogEntry<TCatalog> { Id = id, CampaignId = campaignId, Name = request.Name!, CreatorUserId = access.Subject.Type == SubjectType.User ? access.Subject.Id : null, IsHidden = request.IsHidden.Value, QuantityUnit = metadata.Unit, AllowNegative = metadata.Negative };
        try { return new(ToDto(await store.CreateAsync(entity, ct)), ToEnvelope(prepared, CatalogAttributeValues.FilterReadable(prepared.Data, schema.Data))); }
        catch (DuplicateResourceException) { throw AlreadyPublished(id); }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (exception is DbException or DbUpdateException or ResourceStoreException or CampaignStoreException) { throw new DomainException(503, "publication_outcome_unknown", "The metadata publication outcome could not be confirmed.", id, id); }
    }

    public async Task<CatalogEntryDto> UpdateMetadataAsync(Subject? subject, int campaignId, Guid id, CatalogMetadataUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        var entry = await RequireWritable(access, campaignId, id, ct);
        if (request.ExpectedRevision is not > 0) throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        return await characterCatalog.WithDefinitionLockAsync(campaignId, id, async () =>
        {
            var current = await RequireEntry(campaignId, id, ct);
            EnsureWritable(access, current);
            if (current.MetadataRevision != request.ExpectedRevision) throw Conflict(id, "revision_conflict");
            var hidden = request.IsHidden ?? current.IsHidden;
            if (!access.IsAdmin && hidden != current.IsHidden) throw Forbidden();
            var metadata = ValidateMetadata(request.Name, request.QuantityUnit ?? current.QuantityUnit, request.AllowNegative ?? current.AllowNegative);
            var attached = await characterCatalog.ListByCatalogEntryAsync(campaignId, id, ct);
            var policyChanged = current.QuantityUnit != metadata.Unit || current.AllowNegative != metadata.Negative;
            if (policyChanged && attached.Count > 0 && current.QuantityUnit != metadata.Unit && (current.QuantityUnit == QuantityUnit.Single || metadata.Unit == QuantityUnit.Single))
                throw Conflict(id, "quantity_policy_conflict");
            if (policyChanged && attached.Any(x => !QuantityMatchesPolicy(x.Quantity, metadata.Unit, metadata.Negative))) throw Conflict(id, "quantity_policy_conflict");
            if (!await store.UpdateAsync(campaignId, id, request.Name!, hidden, metadata.Unit, metadata.Negative, request.ExpectedRevision.Value, ct))
            {
                if (await store.GetAsync(campaignId, id, ct) is null) throw NotFound();
                throw Conflict(id, "revision_conflict");
            }
            await PruneContent(campaignId, id, ct);
            return new CatalogEntryDto(id, campaignId, request.Name!, current.CreatorUserId, hidden, metadata.Unit, metadata.Negative, request.ExpectedRevision.Value + 1);
        }, ct);
    }

    public async Task<CatalogContentEnvelope> GetContentAsync(Subject? subject, int campaignId, Guid id, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        if (!CanRead(access, await RequireEntry(campaignId, id, ct))) throw NotFound();
        var raw = await ReadRawContent(campaignId, id, ct);
        var schema = await ReadSchema(campaignId, ct);
        var filtered = CatalogAttributeValues.FilterReadable(raw.Data, schema.Data);
        return ToEnvelope(raw, filtered);
    }

    public async Task<CatalogContentEnvelope> UpdateContentAsync(Subject? subject, int campaignId, Guid id, CatalogContentUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        await RequireWritable(access, campaignId, id, ct);
        if (request.ExpectedRevision is not > 0 || request.Description is null || request.Attributes is null) throw BadRequest("invalid_content", "Required fields are missing.");
        var current = await ReadRawContent(campaignId, id, ct);
        if (current.ContentRevision != request.ExpectedRevision) throw Conflict(id, "content_revision_conflict");
        var schema = await ReadSchema(campaignId, ct);
        var data = CatalogAttributeValues.ValidateContent(new CatalogContent(request.Description, request.Attributes), schema.Data, current.Data.Attributes);
        var result = await content.ReplaceAsync(ContentCollection, campaignId, id, request.ExpectedRevision.Value, data, ct);
        return result is null ? throw Conflict(id, "content_revision_conflict") : ToEnvelope(result, CatalogAttributeValues.FilterReadable(result.Data, schema.Data));
    }

    public async Task<CatalogEntry<TCatalog>> GetVisibleEntryForCharacterAddAsync(Subject? subject, int campaignId, Guid id, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        var entry = await RequireEntry(campaignId, id, ct);
        return CanRead(access, entry) ? entry : throw NotFound();
    }

    public async Task<CatalogDefinitionPreparation<TCatalog>> PrepareCharacterOwnedEntryAsync(Subject? subject, int campaignId, CatalogCreateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        var id = RequireRequestId(request.RequestId);
        var metadata = ValidateMetadata(request.Name, request.QuantityUnit, request.AllowNegative);
        if (request.IsHidden is null || !access.IsAdmin && !request.IsHidden.Value) throw Forbidden();
        if (request.Description is null || request.Attributes is null) throw BadRequest("invalid_content", "Required fields are missing.");
        if (await store.GetAsync(campaignId, id, ct) is not null) throw AlreadyPublished(id);
        var schema = await ReadSchema(campaignId, ct);
        var data = CatalogAttributeValues.ValidateContent(new CatalogContent(request.Description, request.Attributes), schema.Data, null);
        return new(new CatalogEntry<TCatalog> { Id = id, CampaignId = campaignId, Name = request.Name!, CreatorUserId = access.Subject.Type == SubjectType.User ? access.Subject.Id : null, IsHidden = request.IsHidden.Value, QuantityUnit = metadata.Unit, AllowNegative = metadata.Negative }, data, schema);
    }

    public async Task<CatalogAttributeSchemaEnvelope> GetSchemaForCharacterAsync(int campaignId, CancellationToken ct) => await ReadSchema(campaignId, ct);

    public async Task<ContentEnvelope<CatalogContent>> GetDefinitionContentForCharacterAsync(int campaignId, Guid id, CancellationToken ct)
    {
        var raw = await ReadRawContent(campaignId, id, ct);
        var schema = await ReadSchema(campaignId, ct);
        return raw with { Data = CatalogAttributeValues.FilterReadable(raw.Data, schema.Data) };
    }

    private async Task<ContentEnvelope<CatalogContent>> ReadRawContent(int campaignId, Guid id, CancellationToken ct) => await content.GetAsync<CatalogContent>(ContentCollection, campaignId, id, ct) ?? throw new DomainException(503, "content_unavailable", "The published content is unavailable.", id);
    private async Task PruneContent(int campaignId, Guid id, CancellationToken ct)
    {
        var current = await ReadRawContent(campaignId, id, ct);
        var schema = await ReadSchema(campaignId, ct);
        var data = CatalogAttributeValues.FilterReadable(current.Data, schema.Data);
        if (data.Attributes.Length != current.Data.Attributes.Length)
            if (await content.ReplaceAsync(ContentCollection, campaignId, id, current.ContentRevision, data, ct) is null) throw Conflict(id, "content_revision_conflict");
    }
    private async Task<CatalogAttributeSchemaEnvelope> ReadSchema(int campaignId, CancellationToken ct)
    {
        var raw = await ReadRawSchema(campaignId, ct);
        return new(campaignId, raw.ContentRevision, new CatalogAttributeSchema(raw.Data.Definitions.ToArray()));
    }
    private async Task<ContentEnvelope<CatalogAttributeSchema>> ReadRawSchema(int campaignId, CancellationToken ct) => await content.GetAsync<CatalogAttributeSchema>(SchemaCollection, campaignId, Guid.Empty, ct) ?? new ContentEnvelope<CatalogAttributeSchema>(campaignId, Guid.Empty, 0, new CatalogAttributeSchema([]));

    private static CatalogAttributeDefinition[] BuildDefinitions(CatalogAttributeDefinitionInput[] inputs, CatalogAttributeDefinition[] previous)
    {
        var old = previous.ToDictionary(x => x.Id);
        var seen = new HashSet<Guid>();
        var output = new List<CatalogAttributeDefinition>();
        foreach (var input in inputs)
        {
            if (input is null || string.IsNullOrWhiteSpace(input.Title) || string.IsNullOrWhiteSpace(input.TypeKey) || input.Options is null) throw BadRequest("invalid_definition", "Definition fields are required.");
            var options = ValidateOptions(input.TypeKey, input.Options);
            var id = input.Id ?? Guid.NewGuid();
            if (id == Guid.Empty || !seen.Add(id)) throw BadRequest("invalid_definition_id", "Definition IDs must be non-empty and unique.");
            if (input.Id is not null && !old.ContainsKey(id)) throw BadRequest("unknown_attribute", "The definition ID is unknown.");
            output.Add(new(id, input.Title, input.TypeKey, options));
        }
        return output.ToArray();
    }
    private static ChoiceOption[] ValidateOptions(string type, ChoiceOption[] options)
    {
        if (type is not ("integer" or "number" or "string" or "boolean" or "singleChoice" or "multiChoice")) throw BadRequest("invalid_type_key", "typeKey is unknown.");
        if (type is not ("singleChoice" or "multiChoice") && options.Length != 0) throw BadRequest("invalid_options", "Options are only valid for choice types.");
        var keys = new HashSet<string>(StringComparer.Ordinal);
        if (options.Any(x => x is null || string.IsNullOrWhiteSpace(x.OptionKey) || x.Title is null || !keys.Add(x.OptionKey))) throw BadRequest("invalid_options", "Choice option keys must be unique and non-empty.");
        return options.ToArray();
    }
    private static (QuantityUnit? Unit, bool Negative) ValidateMetadata(string? name, QuantityUnit? unit, bool? negative)
    {
        if (string.IsNullOrWhiteSpace(name)) throw BadRequest("invalid_name", "A non-whitespace name is required.");
        if (negative is null) throw BadRequest("invalid_metadata", "allowNegative is required.");
        if (TCatalog.HasQuantity)
        {
            if (unit is null || !Enum.IsDefined(unit.Value)) throw BadRequest("invalid_quantity_unit", "Items require a known quantityUnit.");
            return (unit, negative.Value);
        }
        if (unit is not null || negative.Value) throw BadRequest("invalid_quantity_unit", "Skills require quantityUnit=null and allowNegative=false.");
        return (null, false);
    }
    private static bool QuantityMatchesPolicy(decimal? quantity, QuantityUnit? unit, bool allowNegative) =>
        quantity is not null && (allowNegative || quantity.Value >= 0) && (unit switch
        {
            QuantityUnit.Whole => decimal.Truncate(quantity.Value) == quantity.Value,
            QuantityUnit.Single => quantity.Value == 1,
            QuantityUnit.Fractional => true,
            _ => false
        });

    private async Task<CatalogEntry<TCatalog>> RequireWritable(CampaignAccess access, int campaignId, Guid id, CancellationToken ct)
    {
        var entry = await RequireEntry(campaignId, id, ct);
        EnsureWritable(access, entry);
        return entry;
    }
    private static void EnsureWritable(CampaignAccess access, CatalogEntry<TCatalog> entry)
    {
        if (!CanRead(access, entry)) throw NotFound();
        if (!access.IsAdmin && (access.Subject.Type != SubjectType.User || entry.CreatorUserId != access.Subject.Id)) throw Forbidden();
    }
    private async Task<CatalogEntry<TCatalog>> RequireEntry(int campaignId, Guid id, CancellationToken ct) => await store.GetAsync(campaignId, id, ct) ?? throw NotFound();
    private static CatalogContentEnvelope ToEnvelope(ContentEnvelope<CatalogContent> raw, CatalogContent data) => new(raw.CampaignId, raw.ResourceId, raw.ContentRevision, data);
    private static CatalogEntryDto ToDto(CatalogEntry<TCatalog> entry) => new(entry.Id, entry.CampaignId, entry.Name, entry.CreatorUserId, entry.IsHidden, entry.QuantityUnit, entry.AllowNegative, entry.MetadataRevision);
    private static bool CanRead(CampaignAccess access, CatalogEntry<TCatalog> entry) => !entry.IsHidden || access.IsAdmin || access.Subject.Type == SubjectType.User && entry.CreatorUserId == access.Subject.Id;
    private static Guid RequireRequestId(Guid? id) => id is { } value && value != Guid.Empty ? value : throw BadRequest("invalid_request_id", "A non-empty requestId is required.");
    private static void EnsureAdmin(CampaignAccess access) { if (!access.IsAdmin) throw Forbidden(); }
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException Forbidden() => new(403, "forbidden", "The operation is not permitted.");
    private static DomainException NotFound() => new(404, "not_found", "The requested resource was not found.");
    private static DomainException Conflict(object id, string code) => new(409, code, "The resource revision no longer matches.", id);
    private static DomainException AlreadyPublished(Guid id) => new(409, "already_published", "The resource has already been published.", id, id);
}
