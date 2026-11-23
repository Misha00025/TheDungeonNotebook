using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;

namespace Tdn.Campaigns.Catalog;

public sealed class CharacterCatalogService<TCatalog>(SheetService sheets, CatalogService<TCatalog> catalog, ICatalogStore<TCatalog> catalogStore, ICharacterCatalogStore<TCatalog> store, IContentStore content) where TCatalog : ICatalogType
{
    private static string LocalCollection => TCatalog.CharacterContentsCollection;
    private static string DefinitionCollection => TCatalog.ContentsCollection;

    public async Task<IReadOnlyList<CharacterCatalogEntryEnvelope>> ListAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, false, ct);
        var entries = await store.ListAsync(campaignId, characterId, ct);
        var result = new List<CharacterCatalogEntryEnvelope>();
        foreach (var entry in entries)
        {
            var definition = await catalogStore.GetAsync(campaignId, entry.CatalogEntryId, ct) ?? throw NotFound(entry.Id);
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
        return ToDto(await store.GetAdditionAsync(campaignId, characterId, requestId, ct) ?? throw NotFound(requestId));
    }

    public async Task<(CharacterCatalogAddResponse Result, bool Created)> AddAsync(Subject? subject, int campaignId, Guid characterId, CharacterCatalogAddRequest request, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        var requestId = RequireRequestId(request.RequestId);
        var definitionId = request.CatalogEntryId is { } id && id != Guid.Empty ? id : throw BadRequest("invalid_catalog_entry_id", "A non-empty catalogEntryId is required.");
        if (request.Attributes is null) throw BadRequest("invalid_attributes", "attributes is required.");
        var publicationStarted = false;
        Guid? entryId = null;
        try
        {
            return await store.WithCharacterLockAsync(campaignId, definitionId, characterId, async () =>
            {
                var receipt = await store.GetAdditionAsync(campaignId, characterId, requestId, ct);
                if (receipt is not null) throw AlreadyApplied(receipt);
                var definition = await catalog.GetVisibleEntryForCharacterAddAsync(subject, campaignId, definitionId, ct);
                var schema = await catalog.GetSchemaForCharacterAsync(campaignId, ct);
                var source = await catalog.GetDefinitionContentForCharacterAsync(campaignId, definitionId, ct);
                var sourceValues = CatalogAttributeValues.FilterReadable(source.Data.Attributes, schema.Data);
                var values = ValidateLocalAttributes(request.Attributes, schema.Data, null, sourceValues);
                var quantity = ValidateQuantity(definition, request.Quantity, true);
                var stackable = TCatalog.HasQuantity && definition.QuantityUnit is QuantityUnit.Whole or QuantityUnit.Fractional;
                if (stackable && values.Length > 0) throw BadRequest("stack_state_not_supported", "Stackable items cannot have character attributes.");
                CharacterCatalogEntry<TCatalog> record;
                if (stackable)
                {
                    record = (await store.ListAsync(campaignId, characterId, ct)).SingleOrDefault(x => x.CatalogEntryId == definitionId)!;
                    if (record is not null)
                    {
                        entryId = record.Id;
                        var combined = AddQuantity(record.Quantity!.Value, quantity!.Value);
                        ValidateExistingQuantity(definition, combined);
                        publicationStarted = true;
                        if (!await store.UpdateQuantityAsync(campaignId, characterId, record.Id, combined, record.MetadataRevision, ct)) throw Conflict(record.Id, "revision_conflict");
                        record.Quantity = combined;
                        record.MetadataRevision++;
                        await store.CreateAdditionAsync(NewReceipt(campaignId, characterId, requestId, record.Id, definitionId), ct);
                        return (new CharacterCatalogAddResponse(requestId, await BuildEnvelope(record, definition, ct)), false);
                    }
                }
                record = new CharacterCatalogEntry<TCatalog> { Id = requestId, CampaignId = campaignId, CharacterId = characterId, CatalogEntryId = definitionId, Quantity = quantity };
                entryId = record.Id;
                if (!stackable) await CreateLocalContent(campaignId, record.Id, values, ct);
                publicationStarted = true;
                await store.CreateAsync(record, ct);
                await store.CreateAdditionAsync(NewReceipt(campaignId, characterId, requestId, record.Id, definitionId), ct);
                return (new CharacterCatalogAddResponse(requestId, await BuildEnvelope(record, definition, ct)), true);
            }, ct);
        }
        catch (Exception exception) when (exception is DuplicateCharacterCatalogException or DuplicateResourceException) { throw AlreadyPublished(entryId ?? requestId, requestId); }
        catch (ContentAlreadyPreparedException) { throw ContentAlreadyPrepared(requestId); }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (publicationStarted && IsSqlWriteFailure(exception)) { throw PublicationOutcomeUnknown(entryId ?? requestId, definitionId, requestId); }
    }

    public async Task<CharacterCatalogAddResponse> CreateOwnAsync(Subject? subject, int campaignId, Guid characterId, CharacterCatalogCreateRequest request, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        var requestId = RequireRequestId(request.RequestId);
        if (request.Definition is null || request.Attributes is null) throw BadRequest("invalid_definition", "definition and attributes are required.");
        var input = request.Definition;
        var create = new CatalogCreateRequest { RequestId = requestId, Name = input.Name, IsHidden = input.IsHidden, QuantityUnit = input.QuantityUnit, AllowNegative = input.AllowNegative, Description = input.Description, Attributes = input.Attributes };
        var publicationStarted = false;
        try
        {
            return await store.WithNewDefinitionCharacterLockAsync(campaignId, characterId, async () =>
            {
                var receipt = await store.GetAdditionAsync(campaignId, characterId, requestId, ct);
                if (receipt is not null) throw AlreadyApplied(receipt);
                var prepared = await catalog.PrepareCharacterOwnedEntryAsync(subject, campaignId, create, ct);
                var quantity = ValidateQuantity(prepared.Entry, request.Quantity, true);
                var schema = prepared.Schema.Data;
                var source = CatalogAttributeValues.FilterReadable(prepared.Content.Attributes, schema);
                var values = ValidateLocalAttributes(request.Attributes, schema, null, source);
                var stackable = TCatalog.HasQuantity && prepared.Entry.QuantityUnit is QuantityUnit.Whole or QuantityUnit.Fractional;
                if (stackable && values.Length > 0) throw BadRequest("stack_state_not_supported", "Stackable items cannot have character attributes.");
                var record = new CharacterCatalogEntry<TCatalog> { Id = requestId, CampaignId = campaignId, CharacterId = characterId, CatalogEntryId = requestId, Quantity = quantity };
                await content.CreateAsync(DefinitionCollection, campaignId, requestId, prepared.Content, ct);
                if (!stackable) await CreateLocalContent(campaignId, record.Id, values, ct);
                publicationStarted = true;
                var published = await catalogStore.CreateAsync(prepared.Entry, ct);
                await store.CreateAsync(record, ct);
                await store.CreateAdditionAsync(NewReceipt(campaignId, characterId, requestId, record.Id, requestId), ct);
                return new CharacterCatalogAddResponse(requestId, await BuildEnvelope(record, published, ct));
            }, ct);
        }
        catch (Exception exception) when (exception is DuplicateCharacterCatalogException or DuplicateResourceException) { throw AlreadyPublished(requestId, requestId); }
        catch (ContentAlreadyPreparedException) { throw ContentAlreadyPrepared(requestId); }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (publicationStarted && IsSqlWriteFailure(exception)) { throw PublicationOutcomeUnknown(requestId, requestId, requestId); }
    }

    public async Task<CharacterCatalogEntryEnvelope> UpdateQuantityAsync(Subject? subject, int campaignId, Guid characterId, Guid entryId, CharacterCatalogQuantityUpdateRequest request, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        if (!TCatalog.HasQuantity) throw BadRequest("invalid_quantity", "Skills do not have a quantity.");
        if (request.ExpectedRevision is not > 0 || request.Quantity is null) throw BadRequest("invalid_quantity", "expectedRevision and quantity are required.");
        var entry = await RequireRecord(campaignId, characterId, entryId, ct);
        return await store.WithCharacterLockAsync(campaignId, entry.CatalogEntryId, characterId, async () =>
        {
            entry = await RequireRecord(campaignId, characterId, entryId, ct);
            var definition = await catalogStore.GetAsync(campaignId, entry.CatalogEntryId, ct) ?? throw NotFound(entryId);
            var quantity = ValidateQuantity(definition, request.Quantity, false);
            if (!await store.UpdateQuantityAsync(campaignId, characterId, entryId, quantity, request.ExpectedRevision.Value, ct)) throw Conflict(entryId, "revision_conflict");
            entry.Quantity = quantity;
            entry.MetadataRevision = request.ExpectedRevision.Value + 1;
            await PruneLocal(campaignId, entry, definition, ct);
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
            if (TCatalog.HasQuantity && definition.QuantityUnit != QuantityUnit.Single) throw BadRequest("stack_state_not_supported", "Stackable items cannot have character attributes.");
            var current = await ReadLocalContent(campaignId, entry, ct);
            if (current.ContentRevision != request.ExpectedRevision) throw Conflict(entryId, "content_revision_conflict");
            var sourceRaw = await catalog.GetDefinitionContentForCharacterAsync(campaignId, definition.Id, ct);
            var schema = await catalog.GetSchemaForCharacterAsync(campaignId, ct);
            var source = CatalogAttributeValues.FilterReadable(sourceRaw.Data.Attributes, schema.Data);
            var attributes = ValidateLocalAttributes(request.Attributes, schema.Data, current.Data.Attributes, source);
            var result = await content.ReplaceAsync(LocalCollection, campaignId, entryId, request.ExpectedRevision.Value, new CharacterCatalogContent(attributes), ct);
            if (result is null) throw Conflict(entryId, "content_revision_conflict");
            return await BuildEnvelope(entry, definition, ct, result);
        }, ct);
    }

    public async Task DeleteAsync(Subject? subject, int campaignId, Guid characterId, Guid entryId, long expectedRevision, CancellationToken ct)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, ct);
        if (expectedRevision < 1) throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        var entry = await RequireRecord(campaignId, characterId, entryId, ct);
        await store.WithCharacterLockAsync(campaignId, entry.CatalogEntryId, characterId, async () =>
        {
            if (!await store.DeleteAsync(campaignId, characterId, entryId, expectedRevision, ct)) throw Conflict(entryId, "revision_conflict");
            return true;
        }, ct);
    }

    private async Task<CharacterCatalogEntryEnvelope> BuildEnvelope(CharacterCatalogEntry<TCatalog> entry, CatalogEntry<TCatalog> definition, CancellationToken ct, ContentEnvelope<CharacterCatalogContent>? knownLocal = null)
    {
        var schema = await catalog.GetSchemaForCharacterAsync(entry.CampaignId, ct);
        var definitionContent = await catalog.GetDefinitionContentForCharacterAsync(entry.CampaignId, definition.Id, ct);
        var source = CatalogAttributeValues.FilterReadable(definitionContent.Data.Attributes, schema.Data);
        CatalogAttributeValue[] explicitAttributes;
        long localRevision;
        if (TCatalog.HasQuantity && definition.QuantityUnit != QuantityUnit.Single)
        {
            explicitAttributes = [];
            localRevision = 0;
        }
        else
        {
            var local = knownLocal ?? await ReadLocalContent(entry.CampaignId, entry, ct);
            explicitAttributes = CatalogAttributeValues.FilterReadable(local.Data.Attributes, schema.Data);
            localRevision = local.ContentRevision;
        }
        var effective = BuildEffectiveAttributes(source, explicitAttributes);
        return new(ToDto(entry), ToDto(definition), definitionContent.Data.Description, effective, explicitAttributes, definitionContent.ContentRevision, localRevision);
    }
    private async Task<ContentEnvelope<CharacterCatalogContent>> ReadLocalContent(int campaignId, CharacterCatalogEntry<TCatalog> entry, CancellationToken ct) =>
        await content.GetAsync<CharacterCatalogContent>(LocalCollection, campaignId, entry.Id, ct)
        ?? throw new DomainException(503, "content_unavailable", "The published character content is unavailable.", entry.Id);
    private async Task CreateLocalContent(int campaignId, Guid id, CatalogAttributeValue[] values, CancellationToken ct)
    {
        await content.CreateAsync(LocalCollection, campaignId, id, new CharacterCatalogContent(values), ct);
    }
    private async Task PruneLocal(int campaignId, CharacterCatalogEntry<TCatalog> entry, CatalogEntry<TCatalog> definition, CancellationToken ct)
    {
        if (TCatalog.HasQuantity && definition.QuantityUnit != QuantityUnit.Single) return;
        var current = await ReadLocalContent(campaignId, entry, ct);
        if (current.ContentRevision == 0) return;
        var schema = await catalog.GetSchemaForCharacterAsync(campaignId, ct);
        var pruned = CatalogAttributeValues.FilterReadable(current.Data.Attributes, schema.Data);
        if (pruned.Length != current.Data.Attributes.Length)
            if (await content.ReplaceAsync(LocalCollection, campaignId, entry.Id, current.ContentRevision, new CharacterCatalogContent(pruned), ct) is null) throw Conflict(entry.Id, "content_revision_conflict");
    }
    private static CatalogAttributeValue[] ValidateLocalAttributes(CatalogAttributeValue[] values, CatalogAttributeSchema schema, CatalogAttributeValue[]? previous, CatalogAttributeValue[] source)
    {
        var validated = CatalogAttributeValues.ValidateContent(new CatalogContent(string.Empty, values), schema, previous).Attributes;
        var old = (previous ?? []).Where(x => schema.Definitions.Any(a => a.Id == x.AttributeId)).GroupBy(x => x.Id).ToDictionary(x => x.Key, x => x.First());
        var sourceById = source.ToDictionary(x => x.Id);
        foreach (var value in validated)
        {
            if (sourceById.TryGetValue(value.Id, out var sourceValue))
            {
                if (sourceValue.AttributeId != value.AttributeId) throw BadRequest("attribute_binding_immutable", "A local occurrence cannot change its catalog attribute binding.");
                if (sourceValue.EditLevel != AttributeEditLevel.Character) throw BadRequest("definition_attribute_immutable", "Definition-level catalog attributes cannot be changed on a character entry.");
            }
            if (old.TryGetValue(value.Id, out var existing) && CatalogAttributeValues.IsExactlySame(existing, value)) continue;
            if (value.EditLevel != AttributeEditLevel.Character) throw BadRequest("invalid_edit_level", "Character entries can only change Character-level attributes.");
        }
        return validated;
    }
    private static CatalogAttributeValue[] BuildEffectiveAttributes(CatalogAttributeValue[] source, CatalogAttributeValue[] local)
    {
        var sourceIds = source.Select(x => x.Id).ToHashSet();
        var localById = local.ToDictionary(x => x.Id);
        var effective = source.Select(value => value.EditLevel == AttributeEditLevel.Character && localById.TryGetValue(value.Id, out var explicitValue) && explicitValue.AttributeId == value.AttributeId ? explicitValue : value).ToList();
        effective.AddRange(local.Where(x => !sourceIds.Contains(x.Id)));
        return effective.ToArray();
    }
    private async Task<CharacterCatalogEntry<TCatalog>> RequireRecord(int campaignId, Guid characterId, Guid entryId, CancellationToken ct) => await store.GetAsync(campaignId, characterId, entryId, ct) ?? throw NotFound(entryId);
    private static CatalogAdditionReceipt<TCatalog> NewReceipt(int campaignId, Guid characterId, Guid requestId, Guid entryId, Guid definitionId) => new() { CampaignId = campaignId, CharacterId = characterId, RequestId = requestId, EntryId = entryId, CatalogEntryId = definitionId };
    private static decimal? ValidateQuantity(CatalogEntry<TCatalog> definition, decimal? quantity, bool adding)
    {
        if (!TCatalog.HasQuantity) { if (quantity is not null) throw BadRequest("invalid_quantity", "Skills do not have a quantity."); return null; }
        if (definition.QuantityUnit == QuantityUnit.Single) { if (adding && quantity is null || quantity == 1m) return 1m; throw BadRequest("invalid_quantity", "Single entries always have quantity 1."); }
        if (quantity is null) throw BadRequest("invalid_quantity", "A quantity is required for this item.");
        ValidateExistingQuantity(definition, quantity.Value);
        return quantity;
    }
    private static void ValidateExistingQuantity(CatalogEntry<TCatalog> definition, decimal quantity)
    {
        if (definition.QuantityUnit == QuantityUnit.Whole && decimal.Truncate(quantity) != quantity || !definition.AllowNegative && quantity < 0) throw BadRequest("invalid_quantity", "Quantity violates the current item policy.");
    }
    private static decimal AddQuantity(decimal current, decimal added)
    {
        try
        {
            var result = checked(current + added);
            if (result - current != added || result - added != current) throw BadRequest("quantity_overflow", "The resulting quantity exceeds the decimal range.");
            return result;
        }
        catch (OverflowException) { throw BadRequest("quantity_overflow", "The resulting quantity exceeds the decimal range."); }
    }
    private static bool IsSqlWriteFailure(Exception exception) => exception is DbException or DbUpdateException or ResourceStoreException or CampaignStoreException;
    private static DomainException AlreadyPublished(Guid entryId, Guid requestId) => new(409, "already_published", "The resource has already been published.", entryId, requestId);
    private static DomainException ContentAlreadyPrepared(Guid requestId) => new(409, "content_already_prepared", "Content for this resource is already prepared.", requestId, requestId);
    private static DomainException PublicationOutcomeUnknown(Guid entryId, Guid catalogEntryId, Guid requestId) => new(503, "publication_outcome_unknown", "The metadata publication outcome could not be confirmed.", new { entryId, catalogEntryId }, requestId);
    private static CharacterCatalogEntryDto ToDto(CharacterCatalogEntry<TCatalog> x) => new(x.Id, x.CampaignId, x.CharacterId, x.CatalogEntryId, x.Quantity, x.MetadataRevision);
    private static CatalogEntryDto ToDto(CatalogEntry<TCatalog> x) => new(x.Id, x.CampaignId, x.Name, x.CreatorUserId, x.IsHidden, x.QuantityUnit, x.AllowNegative, x.MetadataRevision);
    private static CharacterCatalogAdditionDto ToDto(CatalogAdditionReceipt<TCatalog> x) => new(x.CampaignId, x.CharacterId, x.RequestId, x.EntryId, x.CatalogEntryId);
    private static Guid RequireRequestId(Guid? id) => id is { } value && value != Guid.Empty ? value : throw BadRequest("invalid_request_id", "A non-empty requestId is required.");
    private static DomainException AlreadyApplied(CatalogAdditionReceipt<TCatalog> receipt) => new(409, "addition_already_applied", "This addition request has already been applied.", receipt.EntryId, receipt.RequestId);
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException NotFound(Guid id) => new(404, "not_found", "The requested resource was not found.", id);
    private static DomainException Conflict(Guid id, string code) => new(409, code, "The resource revision no longer matches.", id);
}
