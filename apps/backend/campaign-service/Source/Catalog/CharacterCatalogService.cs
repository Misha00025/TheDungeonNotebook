using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public sealed class CharacterCatalogService(
    SheetService sheets,
    CatalogService catalog,
    ICatalogStore catalogStore,
    ICharacterCatalogStore store,
    IContentStore content)
{
    private const string LocalCollection = "characterCatalogContents";
    private const string DefinitionCollection = "catalogContents";

    public async Task<IReadOnlyList<CharacterCatalogEntryEnvelope>> ListAsync(Subject? subject, int campaignId, Guid characterId, CatalogKind? kind, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, false, ct);
        if (kind is { } selectedKind && !Enum.IsDefined(selectedKind)) throw BadRequest("invalid_kind", "kind is unknown.");
        var entries = await store.ListAsync(campaignId, characterId, ct);
        var result = new List<CharacterCatalogEntryEnvelope>();
        foreach (var entry in entries)
        {
            var definition = await catalogStore.GetAsync(campaignId, entry.CatalogEntryId, ct) ?? throw NotFound(entry.Id);
            if (kind is not null && definition.Kind != kind) continue;
            result.Add(await BuildEnvelope(entry, definition, ct));
        }
        return result;
    }

    public async Task<CharacterCatalogEntryEnvelope> GetAsync(Subject? subject, int campaignId, Guid characterId, Guid entryId, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, false, ct);
        var entry = await RequireRecord(campaignId, characterId, entryId, ct);
        var definition = await catalogStore.GetAsync(campaignId, entry.CatalogEntryId, ct) ?? throw NotFound(entryId);
        return await BuildEnvelope(entry, definition, ct);
    }

    public async Task<CharacterCatalogAdditionDto> GetAdditionAsync(Subject? subject, int campaignId, Guid characterId, Guid requestId, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, false, ct);
        var receipt = await store.GetAdditionAsync(campaignId, characterId, requestId, ct) ?? throw NotFound(requestId);
        return ToDto(receipt);
    }

    public async Task<(CharacterCatalogAddResponse Result, bool Created)> AddAsync(Subject? subject, int campaignId, Guid characterId, CharacterCatalogAddRequest request, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        var requestId = RequireRequestId(request.RequestId);
        var catalogEntryId = request.CatalogEntryId is { } id && id != Guid.Empty ? id : throw BadRequest("invalid_catalog_entry_id", "A non-empty catalogEntryId is required.");
        if (request.Attributes is null) throw BadRequest("invalid_attributes", "attributes is required.");
        var publicationStarted = false;
        var publicationEntryId = requestId;
        try
        {
            return await store.WithCharacterLockAsync(campaignId, catalogEntryId, characterId, async () =>
            {
                var priorReceipt = await store.GetAdditionAsync(campaignId, characterId, requestId, ct);
                if (priorReceipt is not null) throw AlreadyApplied(priorReceipt);
                var definition = await catalog.GetVisibleEntryForCharacterAddAsync(subject, campaignId, catalogEntryId, ct);
                var schema = await catalog.GetSchemaForCharacterAsync(campaignId, ct);
                var source = await catalog.GetDefinitionContentForCharacterAsync(campaignId, catalogEntryId, ct);
                var attributes = ValidateLocalAttributes(request.Attributes, schema.Data, null, source.Data.Attributes);
                var quantity = ValidateQuantity(definition, request.Quantity, true);

                if (definition.Kind == CatalogKind.Skill || definition.QuantityUnit is QuantityUnit.Whole or QuantityUnit.Fractional)
                {
                    var candidates = (await store.ListAsync(campaignId, characterId, ct))
                        .Where(x => x.CatalogEntryId == catalogEntryId)
                        .OrderBy(x => x.Id);
                    foreach (var candidate in candidates)
                    {
                        var state = await ReadLocalContent(campaignId, candidate, ct);
                        if (!CatalogAttributeValues.SameSet(state.Data.Attributes, attributes)) continue;
                        if (definition.Kind == CatalogKind.Item)
                        {
                            var combined = AddQuantity(candidate.Quantity!.Value, quantity!.Value);
                            ValidateExistingQuantity(definition, combined);
                            publicationEntryId = candidate.Id;
                            publicationStarted = true;
                            if (!await store.UpdateQuantityAsync(campaignId, characterId, candidate.Id, combined, candidate.MetadataRevision, ct))
                            {
                                if (await store.GetAsync(campaignId, characterId, candidate.Id, ct) is null) throw NotFound(candidate.Id);
                                throw Conflict(candidate.Id, "revision_conflict");
                            }
                            candidate.Quantity = combined;
                            candidate.MetadataRevision++;
                        }
                        publicationEntryId = candidate.Id;
                        publicationStarted = true;
                        await CreateReceipt(campaignId, characterId, requestId, candidate.Id, catalogEntryId, ct);
                        var envelope = await BuildEnvelope(candidate, definition, ct);
                        return (new CharacterCatalogAddResponse(requestId, envelope), false);
                    }
                }

                var record = new CharacterCatalogEntry
                {
                    Id = requestId,
                    CampaignId = campaignId,
                    CharacterId = characterId,
                    CatalogEntryId = catalogEntryId,
                    Quantity = quantity
                };
                publicationEntryId = record.Id;
                await CreateLocalContent(campaignId, record.Id, attributes, ct);
                publicationStarted = true;
                await store.CreateAsync(record, ct);
                await CreateReceipt(campaignId, characterId, requestId, record.Id, catalogEntryId, ct);
                return (new CharacterCatalogAddResponse(requestId, await BuildEnvelope(record, definition, ct)), true);
            }, ct);
        }
        catch (DuplicateCharacterCatalogException)
        {
            var receipt = await store.GetAdditionAsync(campaignId, characterId, requestId, ct);
            if (receipt is not null) throw AlreadyApplied(receipt);
            throw AlreadyPublished(requestId);
        }
        catch (ContentAlreadyPreparedException)
        {
            throw new DomainException(409, "content_already_prepared", "Content for this resource is already prepared.", requestId, requestId);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (publicationStarted && IsSqlFailure(exception))
        {
            throw PublicationUnknown(requestId, publicationEntryId, catalogEntryId);
        }
    }

    public async Task<CharacterCatalogAddResponse> CreateOwnAsync(Subject? subject, int campaignId, Guid characterId, CharacterCatalogCreateRequest request, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        var requestId = RequireRequestId(request.RequestId);
        if (request.Definition is null || request.Attributes is null) throw BadRequest("invalid_definition", "definition and attributes are required.");
        var input = request.Definition;
        if (input.Name is null || input.Kind is null || input.IsHidden is null || input.AllowNegative is null || input.Description is null || input.Attributes is null)
            throw BadRequest("invalid_definition", "All definition fields are required.");
        var createRequest = new CatalogCreateRequest
        {
            RequestId = requestId,
            Name = input.Name,
            Kind = input.Kind,
            IsHidden = input.IsHidden,
            QuantityUnit = input.QuantityUnit,
            AllowNegative = input.AllowNegative,
            Description = input.Description,
            Attributes = input.Attributes
        };
        var publicationStarted = false;
        try
        {
            return await store.WithNewDefinitionCharacterLockAsync(campaignId, characterId, async () =>
            {
                var priorReceipt = await store.GetAdditionAsync(campaignId, characterId, requestId, ct);
                if (priorReceipt is not null) throw AlreadyApplied(priorReceipt);
                if (await store.GetAsync(campaignId, characterId, requestId, ct) is not null) throw AlreadyPublished(requestId);
                var prepared = await catalog.PrepareCharacterOwnedEntryAsync(subject, campaignId, createRequest, ct);
                var quantity = ValidateQuantity(prepared.Entry, request.Quantity, true);
                var localAttributes = ValidateLocalAttributes(request.Attributes, prepared.Schema.Data, null, prepared.Content.Attributes);
                var record = new CharacterCatalogEntry
                {
                    Id = requestId,
                    CampaignId = campaignId,
                    CharacterId = characterId,
                    CatalogEntryId = requestId,
                    Quantity = quantity
                };
                await content.CreateAsync(DefinitionCollection, campaignId, requestId, prepared.Content, ct);
                await CreateLocalContent(campaignId, record.Id, localAttributes, ct);
                publicationStarted = true;
                var published = await catalogStore.CreateAsync(prepared.Entry, ct);
                await store.CreateAsync(record, ct);
                await CreateReceipt(campaignId, characterId, requestId, record.Id, requestId, ct);
                return new CharacterCatalogAddResponse(requestId, await BuildEnvelope(record, published, ct));
            }, ct);
        }
        catch (DuplicateResourceException)
        {
            throw AlreadyPublished(requestId);
        }
        catch (DuplicateCharacterCatalogException)
        {
            var receipt = await store.GetAdditionAsync(campaignId, characterId, requestId, ct);
            if (receipt is not null) throw AlreadyApplied(receipt);
            throw AlreadyPublished(requestId);
        }
        catch (ContentAlreadyPreparedException)
        {
            throw new DomainException(409, "content_already_prepared", "Content for this resource is already prepared.", requestId, requestId);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (publicationStarted && IsSqlFailure(exception))
        {
            throw PublicationUnknown(requestId, requestId, requestId);
        }
    }

    public async Task<CharacterCatalogEntryEnvelope> UpdateQuantityAsync(Subject? subject, int campaignId, Guid characterId, Guid entryId, CharacterCatalogQuantityUpdateRequest request, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        if (request.ExpectedRevision is not > 0 || request.Quantity is null) throw BadRequest("invalid_quantity", "expectedRevision and quantity are required.");
        var initial = await RequireRecord(campaignId, characterId, entryId, ct);
        return await store.WithCharacterLockAsync(campaignId, initial.CatalogEntryId, characterId, async () =>
        {
            var entry = await RequireRecord(campaignId, characterId, entryId, ct);
            var definition = await catalogStore.GetAsync(campaignId, entry.CatalogEntryId, ct) ?? throw NotFound(entryId);
            var quantity = ValidateQuantity(definition, request.Quantity, false);
            if (!await store.UpdateQuantityAsync(campaignId, characterId, entryId, quantity, request.ExpectedRevision.Value, ct))
            {
                if (await store.GetAsync(campaignId, characterId, entryId, ct) is null) throw NotFound(entryId);
                throw Conflict(entryId, "revision_conflict");
            }
            entry.Quantity = quantity;
            entry.MetadataRevision = request.ExpectedRevision.Value + 1;
            return await BuildEnvelope(entry, definition, ct);
        }, ct);
    }

    public async Task<CharacterCatalogEntryEnvelope> UpdateAttributesAsync(Subject? subject, int campaignId, Guid characterId, Guid entryId, CharacterCatalogAttributesUpdateRequest request, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        if (request.ExpectedRevision is not > 0 || request.Attributes is null) throw BadRequest("invalid_content", "expectedRevision and attributes are required.");
        var initial = await RequireRecord(campaignId, characterId, entryId, ct);
        return await store.WithCharacterLockAsync(campaignId, initial.CatalogEntryId, characterId, async () =>
        {
            var entry = await RequireRecord(campaignId, characterId, entryId, ct);
            var definition = await catalogStore.GetAsync(campaignId, entry.CatalogEntryId, ct) ?? throw NotFound(entryId);
            var current = await ReadLocalContent(campaignId, entry, ct);
            if (current.ContentRevision != request.ExpectedRevision) throw Conflict(entryId, "content_revision_conflict");
            var source = await catalog.GetDefinitionContentForCharacterAsync(campaignId, definition.Id, ct);
            var schema = await catalog.GetSchemaForCharacterAsync(campaignId, ct);
            var attributes = ValidateLocalAttributes(request.Attributes, schema.Data, current.Data.Attributes, source.Data.Attributes);
            var replacement = await content.ReplaceAsync(LocalCollection, campaignId, entryId, request.ExpectedRevision.Value, new CharacterCatalogContent(attributes), ct);
            if (replacement is null) throw Conflict(entryId, "content_revision_conflict");
            return await BuildEnvelope(entry, definition, ct, replacement);
        }, ct);
    }

    public async Task DeleteAsync(Subject? subject, int campaignId, Guid characterId, Guid entryId, long expectedRevision, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        if (expectedRevision < 1) throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        var initial = await RequireRecord(campaignId, characterId, entryId, ct);
        await store.WithCharacterLockAsync(campaignId, initial.CatalogEntryId, characterId, async () =>
        {
            if (!await store.DeleteAsync(campaignId, characterId, entryId, expectedRevision, ct))
            {
                if (await store.GetAsync(campaignId, characterId, entryId, ct) is null) throw NotFound(entryId);
                throw Conflict(entryId, "revision_conflict");
            }
            return true;
        }, ct);
    }

    private async Task<CharacterCatalogEntryEnvelope> BuildEnvelope(CharacterCatalogEntry entry, CatalogEntry definition, CancellationToken ct, ContentEnvelope<CharacterCatalogContent>? knownLocal = null)
    {
        var definitionContent = await catalog.GetDefinitionContentForCharacterAsync(entry.CampaignId, definition.Id, ct);
        var local = knownLocal ?? await ReadLocalContent(entry.CampaignId, entry, ct);
        var schema = await catalog.GetSchemaForCharacterAsync(entry.CampaignId, ct);
        var diagnostics = BuildDiagnostics(definitionContent.Data, local.Data, schema.Data);
        var effective = BuildEffectiveAttributes(definitionContent.Data.Attributes, local.Data.Attributes);
        return new CharacterCatalogEntryEnvelope(
            ToDto(entry),
            ToDto(definition),
            definitionContent.Data.Description,
            effective,
            local.Data.Attributes,
            diagnostics,
            schema.ContentRevision,
            definitionContent.ContentRevision,
            local.ContentRevision);
    }

    private async Task<ContentEnvelope<CharacterCatalogContent>> ReadLocalContent(int campaignId, CharacterCatalogEntry entry, CancellationToken ct) =>
        await content.GetAsync<CharacterCatalogContent>(LocalCollection, campaignId, entry.Id, ct)
        ?? throw new DomainException(503, "content_unavailable", "The published character content is unavailable.", entry.Id);

    private async Task CreateLocalContent(int campaignId, Guid entryId, CatalogAttributeValue[] attributes, CancellationToken ct)
    {
        try { await content.CreateAsync(LocalCollection, campaignId, entryId, new CharacterCatalogContent(attributes), ct); }
        catch (ContentAlreadyPreparedException) { throw; }
    }

    private static CatalogAttributeValue[] ValidateLocalAttributes(CatalogAttributeValue[] attributes, CatalogAttributeSchema schema, CatalogAttributeValue[]? previous, CatalogAttributeValue[] source)
    {
        var validated = CatalogAttributeValues.ValidateContent(new CatalogContent(string.Empty, attributes), schema, previous).Attributes;
        var previousById = (previous ?? []).ToDictionary(x => x.Id);
        var sourceById = source.ToDictionary(x => x.Id);
        foreach (var value in validated)
        {
            if (previousById.TryGetValue(value.Id, out var old) && CatalogAttributeValues.IsExactlySame(old, value)) continue;
            if (value.EditLevel != AttributeEditLevel.Character) throw BadRequest("invalid_edit_level", "Character entries can only change Character-level attributes.");
            if (sourceById.TryGetValue(value.Id, out var sourceValue))
            {
                if (sourceValue.AttributeId != value.AttributeId) throw BadRequest("attribute_binding_immutable", "A local occurrence cannot change its catalog attribute binding.");
                if (sourceValue.EditLevel != AttributeEditLevel.Character) throw BadRequest("definition_attribute_immutable", "Definition-level catalog attributes cannot be changed on a character entry.");
            }
        }
        return validated;
    }

    private static CatalogAttributeValue[] BuildEffectiveAttributes(CatalogAttributeValue[] source, CatalogAttributeValue[] local)
    {
        var sourceIds = source.Select(x => x.Id).ToHashSet();
        var localById = local.GroupBy(x => x.Id).ToDictionary(x => x.Key, x => x.First());
        var effective = source.Select(value =>
            value.EditLevel == AttributeEditLevel.Character && localById.TryGetValue(value.Id, out var explicitValue) && explicitValue.EditLevel == AttributeEditLevel.Character && explicitValue.AttributeId == value.AttributeId
                ? explicitValue
                : value).ToList();
        effective.AddRange(local.Where(x => !sourceIds.Contains(x.Id) && x.EditLevel == AttributeEditLevel.Character));
        return effective.ToArray();
    }

    private static CatalogDiagnostic[] BuildDiagnostics(CatalogContent definition, CharacterCatalogContent local, CatalogAttributeSchema schema)
    {
        var result = new List<CatalogDiagnostic>();
        result.AddRange(CatalogAttributeValues.Diagnose(definition, schema));
        result.AddRange(CatalogAttributeValues.Diagnose(new CatalogContent(string.Empty, local.Attributes), schema));
        var sourceById = definition.Attributes.GroupBy(x => x.Id).ToDictionary(x => x.Key, x => x.First());
        var reported = result.Select(x => (x.OccurrenceId, x.Code)).ToHashSet();
        foreach (var duplicate in local.Attributes.GroupBy(x => x.Id).Where(x => x.Count() > 1))
            if (reported.Add((duplicate.Key, "invalid_attribute_value"))) result.Add(new(duplicate.Key, "invalid_attribute_value"));
        foreach (var value in local.Attributes)
        {
            string? code = null;
            if (sourceById.TryGetValue(value.Id, out var source))
            {
                if (source.AttributeId != value.AttributeId) code = "attribute_binding_changed";
                else if (source.EditLevel != AttributeEditLevel.Character) code = "edit_level_changed";
            }
            else if (value.EditLevel != AttributeEditLevel.Character) code = "edit_level_changed";
            if (code is not null && reported.Add((value.Id, code))) result.Add(new(value.Id, code));
            if (value.Id == Guid.Empty || !Enum.IsDefined(value.EditLevel))
                if (reported.Add((value.Id, "invalid_attribute_value"))) result.Add(new(value.Id, "invalid_attribute_value"));
        }
        return result.ToArray();
    }

    private async Task<CatalogAdditionReceipt> CreateReceipt(int campaignId, Guid characterId, Guid requestId, Guid entryId, Guid catalogEntryId, CancellationToken ct) =>
        await store.CreateAdditionAsync(new CatalogAdditionReceipt { CampaignId = campaignId, CharacterId = characterId, RequestId = requestId, EntryId = entryId, CatalogEntryId = catalogEntryId }, ct);

    private async Task<CharacterCatalogEntry> RequireRecord(int campaignId, Guid characterId, Guid entryId, CancellationToken ct) =>
        await store.GetAsync(campaignId, characterId, entryId, ct) ?? throw NotFound(entryId);

    private static decimal? ValidateQuantity(CatalogEntry definition, decimal? quantity, bool adding)
    {
        if (definition.Kind == CatalogKind.Skill)
        {
            if (quantity is not null) throw BadRequest("invalid_quantity", "Skills do not have a quantity.");
            return null;
        }
        if (definition.QuantityUnit == QuantityUnit.Single)
        {
            if (adding && quantity is null) return 1m;
            if (quantity != 1m) throw BadRequest("invalid_quantity", "Single entries always have quantity 1.");
            return 1m;
        }
        if (quantity is null) throw BadRequest("invalid_quantity", "A quantity is required for this item.");
        ValidateExistingQuantity(definition, quantity.Value);
        return quantity.Value;
    }

    private static void ValidateExistingQuantity(CatalogEntry definition, decimal? quantity)
    {
        if (definition.Kind == CatalogKind.Skill)
        {
            if (quantity is not null) throw BadRequest("invalid_quantity", "Skills do not have a quantity.");
            return;
        }
        if (quantity is null) throw BadRequest("invalid_quantity", "A quantity is required for this item.");
        if (definition.QuantityUnit == QuantityUnit.Whole && decimal.Truncate(quantity.Value) != quantity.Value)
            throw BadRequest("invalid_quantity", "Whole quantities must be integral.");
        if (!definition.AllowNegative && quantity.Value < 0)
            throw BadRequest("invalid_quantity", "Negative quantities are not allowed for this item.");
    }

    private static decimal AddQuantity(decimal current, decimal added)
    {
        try
        {
            var result = checked(current + added);
            if (result - current != added || result - added != current) throw new OverflowException();
            return result;
        }
        catch (OverflowException) { throw BadRequest("quantity_overflow", "The resulting quantity exceeds the decimal range."); }
    }

    private static Guid RequireRequestId(Guid? requestId) => requestId is { } id && id != Guid.Empty ? id : throw BadRequest("invalid_request_id", "A non-empty requestId is required.");
    private static CharacterCatalogEntryDto ToDto(CharacterCatalogEntry x) => new(x.Id, x.CampaignId, x.CharacterId, x.CatalogEntryId, x.Quantity, x.MetadataRevision);
    private static CatalogEntryDto ToDto(CatalogEntry x) => new(x.Id, x.CampaignId, x.Name, x.Kind, x.CreatorUserId, x.IsHidden, x.QuantityUnit, x.AllowNegative, x.MetadataRevision);
    private static CharacterCatalogAdditionDto ToDto(CatalogAdditionReceipt x) => new(x.CampaignId, x.CharacterId, x.RequestId, x.EntryId, x.CatalogEntryId);
    private static DomainException AlreadyApplied(CatalogAdditionReceipt receipt) => new(409, "addition_already_applied", "This addition request has already been applied.", receipt.EntryId, receipt.RequestId);
    private static DomainException PublicationUnknown(Guid requestId, Guid entryId, Guid catalogEntryId) => new(503, "publication_outcome_unknown", "The SQL publication outcome could not be confirmed.", new { entryId, catalogEntryId }, requestId);
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException NotFound(Guid id) => new(404, "not_found", "The requested resource was not found.", id);
    private static DomainException Conflict(Guid id, string code) => new(409, code, "The resource revision no longer matches.", id);
    private static DomainException AlreadyPublished(Guid requestId) => new(409, "already_published", "The resource has already been published.", requestId, requestId);
    private static bool IsSqlFailure(Exception exception) => exception is DbException or DbUpdateException or CampaignStoreException or ResourceStoreException;
}
