using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public sealed class CharacterCatalogServiceTests
{
    private static readonly Subject GlobalAdmin = new(SubjectType.Admin, 9);
    private static readonly Subject CampaignAdmin = new(SubjectType.User, 100);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task CharacterAccessFailuresDoNotWriteSqlOrMongo()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(userId: 0);
        var writes = f.Sheets.Content.WriteCount;
        var transactions = f.Store.TransactionCount;

        Assert.Equal(403, (await Error(() => f.Service.ListAsync(null, 7, character, null, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.AddAsync(new Subject((SubjectType)77, 9), 7, character,
            AddRequest(Guid.NewGuid(), Guid.NewGuid(), null, []), default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.GetAsync(Member, 7, character, Guid.NewGuid(), default))).StatusCode);

        f.Sheets.Campaigns.SeedCampaign(8);
        Assert.Equal(404, (await Error(() => f.Service.ListAsync(Member, 8, Guid.NewGuid(), null, default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(Member, 7, Guid.NewGuid(), Guid.NewGuid(), default))).StatusCode);
        Assert.Equal(writes, f.Sheets.Content.WriteCount);
        Assert.Equal(transactions, f.Store.TransactionCount);
        Assert.Equal(0, f.Store.WriteAttempts);
    }

    [Fact]
    public async Task HiddenAttachedDefinitionsRemainReadableButCannotBeNewlyAddedByAnUnprivilegedWriter()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: false);
        Assert.Empty(await f.Service.ListAsync(Member, 7, character, null, default));
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Secret", "integer"));
        var secretValue = CharacterCatalogTestFixture.Value(Guid.NewGuid(), Assert.Single(schema.Data.Definitions).Id, "integer", 1, "99", AttributeEditLevel.Definition);
        var item = await f.CreateDefinitionAsync(CatalogKind.Item, hidden: true, attributes: [secretValue]);
        var skill = await f.CreateDefinitionAsync(CatalogKind.Skill, hidden: true, unit: null);
        var attachedItem = await f.Service.AddAsync(GlobalAdmin, 7, character, AddRequest(Guid.NewGuid(), item.Entry.Id, 1m, []), default);
        var attachedSkill = await f.Service.AddAsync(GlobalAdmin, 7, character, AddRequest(Guid.NewGuid(), skill.Entry.Id, null, []), default);

        var visible = await f.Service.ListAsync(Member, 7, character, null, default);
        Assert.Equal(2, visible.Count);
        Assert.All(visible, x => Assert.True(x.Definition.IsHidden));
        Assert.Contains(visible, x => x.Record.Id == attachedItem.Result.Entry.Record.Id);
        Assert.Contains(visible, x => x.Record.Id == attachedSkill.Result.Entry.Record.Id);
        var hiddenItem = await f.Service.GetAsync(Member, 7, character, attachedItem.Result.Entry.Record.Id, default);
        Assert.True(hiddenItem.Definition.IsHidden);
        Assert.Equal("99", hiddenItem.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Equal(404, (await Error(() => f.Catalog.GetAsync(Member, 7, item.Entry.Id, default))).StatusCode);
        var publicDefinition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var readOnlySqlWrites = f.Store.WriteAttempts;
        var readOnlyMongoWrites = f.Sheets.Content.WriteCount;
        Assert.Equal(403, (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), publicDefinition.Entry.Id, 1m, []), default))).StatusCode);
        Assert.Equal(readOnlySqlWrites, f.Store.WriteAttempts);
        Assert.Equal(readOnlyMongoWrites, f.Sheets.Content.WriteCount);

        var writerCharacter = await f.AddCharacterAsync(canWrite: true);
        var writes = f.Sheets.Content.WriteCount;
        var sqlWrites = f.Store.WriteAttempts;
        var hiddenAdd = await Error(() => f.Service.AddAsync(Member, 7, writerCharacter, AddRequest(Guid.NewGuid(), item.Entry.Id, 1m, []), default));
        Assert.Equal(404, hiddenAdd.StatusCode);
        Assert.Equal(writes, f.Sheets.Content.WriteCount);
        Assert.Equal(sqlWrites, f.Store.WriteAttempts);
    }

    [Fact]
    public async Task WholeStacksMergeByExplicitStateReceiptsAreIdempotentAndSurviveDelete()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var firstRequest = Guid.NewGuid();
        var secondRequest = Guid.NewGuid();
        var first = await f.Service.AddAsync(Member, 7, character, AddRequest(firstRequest, definition.Entry.Id, 2m, []), default);
        Assert.True(first.Created);
        Assert.Equal(2m, first.Result.Entry.Record.Quantity);
        Assert.Equal(1, first.Result.Entry.Record.MetadataRevision);
        var writesBeforeMerge = f.Sheets.Content.WriteCount;

        var merged = await f.Service.AddAsync(Member, 7, character, AddRequest(secondRequest, definition.Entry.Id, 3m, []), default);
        Assert.False(merged.Created);
        Assert.Equal(first.Result.Entry.Record.Id, merged.Result.Entry.Record.Id);
        Assert.Equal(5m, merged.Result.Entry.Record.Quantity);
        Assert.Equal(2, merged.Result.Entry.Record.MetadataRevision);
        Assert.Single(await f.Service.ListAsync(Member, 7, character, null, default));
        Assert.Equal(writesBeforeMerge, f.Sheets.Content.WriteCount);
        Assert.Equal(2, f.Store.Receipts.Count);

        var duplicate = await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(secondRequest, definition.Entry.Id, 3m, []), default));
        Assert.Equal("addition_already_applied", duplicate.Code);
        Assert.Equal(first.Result.Entry.Record.Id, Assert.IsType<Guid>(duplicate.ResourceId));
        Assert.Equal<Guid?>(secondRequest, duplicate.RequestId);
        Assert.Equal(5m, (await f.Service.GetAsync(Member, 7, character, first.Result.Entry.Record.Id, default)).Record.Quantity);

        var receipt = await f.Service.GetAdditionAsync(Member, 7, character, secondRequest, default);
        Assert.Equal(first.Result.Entry.Record.Id, receipt.EntryId);
        Assert.Equal(definition.Entry.Id, receipt.CatalogEntryId);
        Assert.Equal(404, (await Error(() => f.Service.GetAdditionAsync(Member, 7, character, Guid.NewGuid(), default))).StatusCode);
        var unassigned = await f.AddCharacterAsync(userId: 0);
        Assert.Equal(403, (await Error(() => f.Service.GetAdditionAsync(Member, 7, unassigned, secondRequest, default))).StatusCode);

        await f.Service.DeleteAsync(Member, 7, character, first.Result.Entry.Record.Id, 2, default);
        Assert.Empty(await f.Service.ListAsync(Member, 7, character, null, default));
        Assert.Equal(first.Result.Entry.Record.Id, (await f.Service.GetAdditionAsync(Member, 7, character, secondRequest, default)).EntryId);
        Assert.Equal("addition_already_applied", (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(secondRequest, definition.Entry.Id, 3m, []), default))).Code);
        Assert.Equal(2, f.Store.Receipts.Count);
    }

    [Fact]
    public async Task ExplicitAttributeSetsAreOrderIndependentButDifferentStatesRemainSeparate()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Trait", "integer"));
        var attributeId = Assert.Single(schema.Data.Definitions).Id;
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var firstValue = CharacterCatalogTestFixture.Value(Guid.NewGuid(), attributeId, "integer", 1, "4");
        var secondValue = CharacterCatalogTestFixture.Value(Guid.NewGuid(), attributeId, "integer", 1, "8");

        var first = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 2m, [firstValue, secondValue]), default);
        var sameSet = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 3m, [secondValue, firstValue]), default);
        Assert.False(sameSet.Created);
        Assert.Equal(first.Result.Entry.Record.Id, sameSet.Result.Entry.Record.Id);
        Assert.Equal(5m, sameSet.Result.Entry.Record.Quantity);
        Assert.Equal(new[] { firstValue.Id, secondValue.Id }, f.Sheets.Content.GetData<CharacterCatalogContent>("characterCatalogContents", 7, first.Result.Entry.Record.Id).Attributes.Select(x => x.Id));

        var changedValue = secondValue with { Value = CharacterCatalogTestFixture.Json("9") };
        var differentState = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 1m, [firstValue, changedValue]), default);
        Assert.True(differentState.Created);
        Assert.NotEqual(first.Result.Entry.Record.Id, differentState.Result.Entry.Record.Id);
        Assert.Equal(2, (await f.Service.ListAsync(Member, 7, character, CatalogKind.Item, default)).Count);
        await f.Service.UpdateAttributesAsync(Member, 7, character, differentState.Result.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [firstValue, secondValue] }, default);
        Assert.Equal(2, (await f.Service.ListAsync(Member, 7, character, CatalogKind.Item, default)).Count);
        Assert.Equal(3, f.Store.Receipts.Count);
    }

    [Fact]
    public async Task InvalidAddAttributesAreRejectedBeforeMongoSqlRecordOrReceiptWrites()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Count", "integer"));
        var attributeId = Assert.Single(schema.Data.Definitions).Id;
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var contentWrites = f.Sheets.Content.WriteCount;
        var invalidValues = new[]
        {
            CharacterCatalogTestFixture.Value(Guid.NewGuid(), attributeId, "number", 1, "1"),
            CharacterCatalogTestFixture.Value(Guid.NewGuid(), attributeId, "integer", 0, "1"),
            CharacterCatalogTestFixture.Value(Guid.NewGuid(), Guid.NewGuid(), "integer", 1, "1"),
            CharacterCatalogTestFixture.Value(Guid.NewGuid(), attributeId, "integer", 1, "1", AttributeEditLevel.Definition)
        };
        foreach (var value in invalidValues)
            Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 1m, [value]), default))).StatusCode);
        var duplicateId = Guid.NewGuid();
        Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character,
            AddRequest(Guid.NewGuid(), definition.Entry.Id, 1m,
                [CharacterCatalogTestFixture.Value(duplicateId, attributeId, "integer", 1, "1"), CharacterCatalogTestFixture.Value(duplicateId, attributeId, "integer", 1, "2")]), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character,
            new CharacterCatalogAddRequest { RequestId = Guid.NewGuid(), CatalogEntryId = definition.Entry.Id, Quantity = 1m, Attributes = null }, default))).StatusCode);
        Assert.Equal(contentWrites, f.Sheets.Content.WriteCount);
        Assert.Equal(0, f.Store.WriteAttempts);
        Assert.Empty(f.Store.Entries);
        Assert.Empty(f.Store.Receipts);
    }

    [Fact]
    public async Task SingleItemsAreSeparateAndSkillsDeduplicateOnlyIdenticalStateWithoutQuantity()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var single = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Single);
        var first = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), single.Entry.Id, null, []), default);
        var second = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), single.Entry.Id, 1m, []), default);
        Assert.True(first.Created);
        Assert.True(second.Created);
        Assert.Equal(1m, first.Result.Entry.Record.Quantity);
        Assert.Equal(1m, second.Result.Entry.Record.Quantity);
        var singleUpdated = await f.Service.UpdateQuantityAsync(Member, 7, character, first.Result.Entry.Record.Id,
            new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 1m }, default);
        Assert.Equal(2, singleUpdated.Record.MetadataRevision);
        Assert.Equal(400, (await Error(() => f.Service.UpdateQuantityAsync(Member, 7, character, first.Result.Entry.Record.Id,
            new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 2, Quantity = 0m }, default))).StatusCode);
        await f.Service.DeleteAsync(Member, 7, character, first.Result.Entry.Record.Id, 2, default);
        Assert.Equal(second.Result.Entry.Record.Id, Assert.Single(await f.Service.ListAsync(Member, 7, character, CatalogKind.Item, default)).Record.Id);
        foreach (var badQuantity in new decimal?[] { 0m, 2m, -1m })
            Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), single.Entry.Id, badQuantity, []), default))).StatusCode);

        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Quality", "integer"));
        var attributeId = Assert.Single(schema.Data.Definitions).Id;
        var skill = await f.CreateDefinitionAsync(CatalogKind.Skill, unit: null);
        var skillValue = CharacterCatalogTestFixture.Value(Guid.NewGuid(), attributeId, "integer", 1, "1");
        var skillFirst = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), skill.Entry.Id, null, [skillValue]), default);
        var skillRepeat = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), skill.Entry.Id, null, [skillValue]), default);
        Assert.True(skillFirst.Created);
        Assert.False(skillRepeat.Created);
        Assert.Equal(skillFirst.Result.Entry.Record.Id, skillRepeat.Result.Entry.Record.Id);
        Assert.Null(skillRepeat.Result.Entry.Record.Quantity);
        var distinctSkill = await f.Service.AddAsync(Member, 7, character,
            AddRequest(Guid.NewGuid(), skill.Entry.Id, null, [skillValue with { Value = CharacterCatalogTestFixture.Json("2") }]), default);
        Assert.True(distinctSkill.Created);
        Assert.Equal(2, (await f.Service.ListAsync(Member, 7, character, CatalogKind.Skill, default)).Count);
        Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), skill.Entry.Id, 1m, [skillValue]), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.UpdateQuantityAsync(Member, 7, character, skillFirst.Result.Entry.Record.Id,
            new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 1 }, default))).StatusCode);
    }

    [Fact]
    public async Task QuantitiesValidateUnitsPreserveZeroNegativesAndDecimalPrecisionWithoutRounding()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var whole = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var writes = f.Store.WriteAttempts;
        Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), whole.Entry.Id, null, []), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), whole.Entry.Id, 1.25m, []), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), whole.Entry.Id, -1m, []), default))).StatusCode);
        Assert.Equal(writes, f.Store.WriteAttempts);

        var zero = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), whole.Entry.Id, 0m, []), default);
        Assert.True(zero.Created);
        Assert.Equal(400, (await Error(() => f.Service.UpdateQuantityAsync(Member, 7, character, zero.Result.Entry.Record.Id,
            new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 1.5m }, default))).StatusCode);
        var zeroMerge = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), whole.Entry.Id, 0m, []), default);
        Assert.False(zeroMerge.Created);
        Assert.Equal(0m, zeroMerge.Result.Entry.Record.Quantity);
        Assert.Single(await f.Service.ListAsync(Member, 7, character, CatalogKind.Item, default));

        var fractional = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Fractional, allowNegative: true);
        var tenth = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), fractional.Entry.Id, 0.1m, []), default);
        var twoTenths = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), fractional.Entry.Id, 0.2m, []), default);
        Assert.Equal(0.3m, twoTenths.Result.Entry.Record.Quantity);
        Assert.Equal(0.3m, (await f.Service.GetAsync(Member, 7, character, tenth.Result.Entry.Record.Id, default)).Record.Quantity);
        var negative = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), fractional.Entry.Id, -1.5m, []), default);
        Assert.Equal(-1.2m, negative.Result.Entry.Record.Quantity);
        var negativeUpdated = await f.Service.UpdateQuantityAsync(Member, 7, character, negative.Result.Entry.Record.Id,
            new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 3, Quantity = -2.5m }, default);
        Assert.Equal(-2.5m, negativeUpdated.Record.Quantity);

        var overflowDefinition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Fractional, allowNegative: true);
        var max = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), overflowDefinition.Entry.Id, decimal.MaxValue, []), default);
        var contentWrites = f.Sheets.Content.WriteCount;
        var sqlWrites = f.Store.WriteAttempts;
        var overflow = await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), overflowDefinition.Entry.Id, decimal.MaxValue, []), default));
        Assert.Equal("quantity_overflow", overflow.Code);
        Assert.Equal(contentWrites, f.Sheets.Content.WriteCount);
        Assert.Equal(sqlWrites, f.Store.WriteAttempts);
        Assert.Equal(decimal.MaxValue, (await f.Service.GetAsync(Member, 7, character, max.Result.Entry.Record.Id, default)).Record.Quantity);
    }

    [Fact]
    public async Task AddTransactionsUseDefinitionThenCharacterLocksAndUnknownCommitIsVerifiable()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var first = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 2m, []), default);
        Assert.Equal(new[] { $"definition:{definition.Entry.Id}", $"character:{character}" }, f.Store.LockOrder.TakeLast(2));

        var unknownRequest = Guid.NewGuid();
        f.Store.AfterCommitFailure = new DbUpdateException("commit outcome unknown");
        var unknown = await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(unknownRequest, definition.Entry.Id, 3m, []), default));
        Assert.Equal(503, unknown.StatusCode);
        Assert.Equal("publication_outcome_unknown", unknown.Code);
        Assert.Equal<Guid?>(unknownRequest, unknown.RequestId);
        using (var resource = JsonDocument.Parse(JsonSerializer.Serialize(unknown.ResourceId)))
        {
            Assert.Equal(first.Result.Entry.Record.Id.ToString("D"), resource.RootElement.GetProperty("entryId").GetString());
            Assert.Equal(definition.Entry.Id.ToString("D"), resource.RootElement.GetProperty("catalogEntryId").GetString());
        }
        var receipt = await f.Service.GetAdditionAsync(Member, 7, character, unknownRequest, default);
        Assert.Equal(first.Result.Entry.Record.Id, receipt.EntryId);
        Assert.Equal(5m, (await f.Service.GetAsync(Member, 7, character, receipt.EntryId, default)).Record.Quantity);
        Assert.Equal("addition_already_applied", (await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(unknownRequest, definition.Entry.Id, 3m, []), default))).Code);
        Assert.Equal(5m, (await f.Service.GetAsync(Member, 7, character, receipt.EntryId, default)).Record.Quantity);
    }

    [Fact]
    public async Task OwnCreatePreparesBothMongoDocumentsBeforeAtomicSqlPublicationAndDerivesCreator()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Power", "integer"));
        var attributeId = Assert.Single(schema.Data.Definitions).Id;
        var occurrenceId = Guid.NewGuid();
        var definitionValue = CharacterCatalogTestFixture.Value(occurrenceId, attributeId, "integer", 1, "1");
        var localValue = definitionValue with { Value = CharacterCatalogTestFixture.Json("2") };
        var requestId = Guid.NewGuid();
        var definition = OwnedDefinition("Private tonic", CatalogKind.Item, true, QuantityUnit.Whole, false, [definitionValue]);
        f.CatalogStore.BeforeCreate = entry =>
        {
            Assert.True(f.Store.InsideTransaction);
            Assert.NotNull(f.Sheets.Content.GetData<CatalogContent>("catalogContents", 7, entry.Id));
            Assert.NotNull(f.Sheets.Content.GetData<CharacterCatalogContent>("characterCatalogContents", 7, entry.Id));
        };
        f.Store.BeforeRecordCreate = entry => Assert.True(f.Store.InsideTransaction);

        var result = await f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest { RequestId = requestId, Definition = definition, Quantity = 1m, Attributes = [localValue] }, default);

        Assert.Equal(requestId, result.Entry.Record.Id);
        Assert.Equal(requestId, result.Entry.Record.CatalogEntryId);
        Assert.Equal<int?>(200, result.Entry.Definition.CreatorUserId);
        Assert.True(result.Entry.Definition.IsHidden);
        Assert.Equal(1m, result.Entry.Record.Quantity);
        Assert.Equal("2", result.Entry.EffectiveAttributes.Single().Value.GetRawText());
        var createLockTrace = f.Store.LockOrder.ToArray();
        Assert.Equal(new[] { $"character:{character}" }, createLockTrace.TakeLast(1));
        Assert.DoesNotContain(createLockTrace, x => x.StartsWith("definition:", StringComparison.Ordinal));
        var locksBeforeMetadataUpdate = f.Store.LockOrder.Count;
        var opened = await f.Catalog.UpdateMetadataAsync(GlobalAdmin, 7, requestId,
            new CatalogMetadataUpdateRequest { Name = "Opened tonic", IsHidden = false, ExpectedRevision = 1 }, default);
        Assert.False(opened.IsHidden);
        Assert.Equal(requestId, (await f.Catalog.GetAsync(Member, 7, requestId, default)).Id);
        Assert.Equal($"definition:{requestId}", f.Store.LockOrder[locksBeforeMetadataUpdate]);
        Assert.Equal(requestId, (await f.Service.GetAdditionAsync(Member, 7, character, requestId, default)).EntryId);
        Assert.Equal("addition_already_applied", (await Error(() => f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest { RequestId = requestId, Definition = definition, Quantity = 1m, Attributes = [localValue] }, default))).Code);
    }

    [Fact]
    public async Task OwnCreateEnforcesPrivateCreationAndDefinitionLevelProtectionBeforeMongoWrites()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Power", "integer"));
        var definition = OwnedDefinition("Public request", CatalogKind.Item, false, QuantityUnit.Whole, false, []);
        var contentWrites = f.Sheets.Content.WriteCount;
        var sqlWrites = f.Store.WriteAttempts;
        var catalogSqlWrites = f.CatalogStore.CreateCount;
        var publicEntry = await Error(() => f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest { RequestId = Guid.NewGuid(), Definition = definition, Quantity = 1m, Attributes = [] }, default));
        Assert.Equal(403, publicEntry.StatusCode);
        Assert.Equal(contentWrites, f.Sheets.Content.WriteCount);
        Assert.Equal(sqlWrites, f.Store.WriteAttempts);
        Assert.Equal(catalogSqlWrites, f.CatalogStore.CreateCount);

        var sourceOccurrenceId = Guid.NewGuid();
        var characterLevelValue = CharacterCatalogTestFixture.Value(sourceOccurrenceId, schema.Data.Definitions.Single().Id, "integer", 1, "1");
        var unknownDefinitionValue = CharacterCatalogTestFixture.Value(Guid.NewGuid(), Guid.NewGuid(), "integer", 1, "1", AttributeEditLevel.Definition);
        var beforeInvalidDefinition = f.Sheets.Content.WriteCount;
        Assert.Equal(400, (await Error(() => f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest
            {
                RequestId = Guid.NewGuid(),
                Definition = OwnedDefinition("Unknown source", CatalogKind.Item, true, QuantityUnit.Whole, false, [unknownDefinitionValue]),
                Quantity = 1m,
                Attributes = []
            }, default))).StatusCode);
        Assert.Equal(beforeInvalidDefinition, f.Sheets.Content.WriteCount);
        Assert.Equal(sqlWrites, f.Store.WriteAttempts);
        Assert.Equal(catalogSqlWrites, f.CatalogStore.CreateCount);
        Assert.Equal(400, (await Error(() => f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest
            {
                RequestId = Guid.NewGuid(),
                Definition = OwnedDefinition("Unknown local", CatalogKind.Item, true, QuantityUnit.Whole, false, []),
                Quantity = 1m,
                Attributes = [unknownDefinitionValue with { Id = Guid.NewGuid(), AttributeId = schema.Data.Definitions.Single().Id }]
            }, default))).StatusCode);
        Assert.Equal(beforeInvalidDefinition, f.Sheets.Content.WriteCount);
        Assert.Equal(sqlWrites, f.Store.WriteAttempts);
        Assert.Equal(catalogSqlWrites, f.CatalogStore.CreateCount);

        var alreadyPublishedId = Guid.NewGuid();
        await f.Catalog.CreateAsync(GlobalAdmin, 7, new CatalogCreateRequest
        {
            RequestId = alreadyPublishedId, Name = "Already shared", Kind = CatalogKind.Item, IsHidden = false,
            QuantityUnit = QuantityUnit.Whole, AllowNegative = false, Description = "", Attributes = []
        }, default);
        var writesBeforeCollision = f.Sheets.Content.WriteCount;
        Assert.Equal(409, (await Error(() => f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest
            {
                RequestId = alreadyPublishedId,
                Definition = OwnedDefinition("Must not attach", CatalogKind.Item, true, QuantityUnit.Whole, false, []),
                Quantity = 1m,
                Attributes = []
            }, default))).StatusCode);
        Assert.Equal(writesBeforeCollision, f.Sheets.Content.WriteCount);
        Assert.Empty(f.Store.Entries);

        var owns = await f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest
            {
                RequestId = Guid.NewGuid(),
                Definition = OwnedDefinition("Character value", CatalogKind.Item, true, QuantityUnit.Whole, false, [characterLevelValue]),
                Quantity = 1m,
                Attributes = [characterLevelValue with { Value = CharacterCatalogTestFixture.Json("2") }]
            }, default);
        Assert.Equal("2", owns.Entry.EffectiveAttributes.Single().Value.GetRawText());
        var definitionOccurrence = characterLevelValue with { Id = Guid.NewGuid(), EditLevel = AttributeEditLevel.Definition };
        var definitionOwned = await f.Service.CreateOwnAsync(Member, 7, character,
            new CharacterCatalogCreateRequest
            {
                RequestId = Guid.NewGuid(),
                Definition = OwnedDefinition("Definition value", CatalogKind.Item, true, QuantityUnit.Whole, false, [definitionOccurrence]),
                Quantity = 1m,
                Attributes = []
            }, default);
        var forbiddenState = await Error(() => f.Service.UpdateAttributesAsync(Member, 7, character, owns.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [characterLevelValue with { Value = CharacterCatalogTestFixture.Json("3"), EditLevel = AttributeEditLevel.Definition }] }, default));
        Assert.Equal(400, forbiddenState.StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.UpdateAttributesAsync(Member, 7, character, definitionOwned.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [definitionOccurrence with { Value = CharacterCatalogTestFixture.Json("5"), EditLevel = AttributeEditLevel.Character }] }, default))).StatusCode);

        var adminCharacter = await f.AddCharacterAsync(userId: 100, canWrite: true);
        var publicByManager = await f.Service.CreateOwnAsync(CampaignAdmin, 7, adminCharacter,
            new CharacterCatalogCreateRequest { RequestId = Guid.NewGuid(), Definition = definition, Quantity = 1m, Attributes = [] }, default);
        Assert.False(publicByManager.Entry.Definition.IsHidden);
        Assert.Equal<int?>(100, publicByManager.Entry.Definition.CreatorUserId);

        var groupCharacter = await f.AddCharacterAsync(userId: 0);
        var groupCreated = await f.Service.CreateOwnAsync(new Subject(SubjectType.Group, 7), 7, groupCharacter,
            new CharacterCatalogCreateRequest
            {
                RequestId = Guid.NewGuid(),
                Definition = OwnedDefinition("Group-authorized skill", CatalogKind.Skill, false, null, false, []),
                Attributes = []
            }, default);
        Assert.Null(groupCreated.Entry.Definition.CreatorUserId);
        Assert.Null(groupCreated.Entry.Record.Quantity);

        var globalAdminCharacter = await f.AddCharacterAsync(userId: 0);
        var globalAdminCreated = await f.Service.CreateOwnAsync(GlobalAdmin, 7, globalAdminCharacter,
            new CharacterCatalogCreateRequest
            {
                RequestId = Guid.NewGuid(),
                Definition = OwnedDefinition("Global administrator skill", CatalogKind.Skill, false, null, false, []),
                Attributes = []
            }, default);
        Assert.Null(globalAdminCreated.Entry.Definition.CreatorUserId);
        Assert.Null(globalAdminCreated.Entry.Record.Quantity);

        var adminSubjectCharacter = await f.AddCharacterAsync(userId: 0);
        var adminCreated = await f.Service.CreateOwnAsync(GlobalAdmin, 7, adminSubjectCharacter,
            new CharacterCatalogCreateRequest
            {
                RequestId = Guid.NewGuid(),
                Definition = OwnedDefinition("Administrator skill", CatalogKind.Skill, false, null, false, []),
                Attributes = []
            }, default);
        Assert.Null(adminCreated.Entry.Definition.CreatorUserId);
        Assert.Null(adminCreated.Entry.Record.Quantity);
    }

    [Fact]
    public async Task FailedPublicationRollsBackSqlButKeepsPreparedMongoAndCanceledPreparationIsNotMasked()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        f.Store.BeforeCommitFailure = new DbUpdateException("not confirmed");
        var requestId = Guid.NewGuid();
        var failure = await Error(() => f.Service.AddAsync(Member, 7, character, AddRequest(requestId, definition.Entry.Id, 1m, []), default));
        Assert.Equal(503, failure.StatusCode);
        Assert.Empty(f.Store.Entries);
        Assert.Empty(f.Store.Receipts);
        Assert.NotNull(f.Sheets.Content.GetData<CharacterCatalogContent>("characterCatalogContents", 7, requestId));
        Assert.Equal(404, (await Error(() => f.Service.GetAdditionAsync(Member, 7, character, requestId, default))).StatusCode);

        var canceled = CharacterCatalogTestFixture.Create();
        var canceledCharacter = await canceled.AddCharacterAsync(canWrite: true);
        var canceledDefinition = await canceled.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        canceled.Sheets.Content.CreateFailure = new OperationCanceledException();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => canceled.Service.AddAsync(Member, 7, canceledCharacter,
            AddRequest(Guid.NewGuid(), canceledDefinition.Entry.Id, 1m, []), default));
        Assert.Equal(0, canceled.Store.WriteAttempts);
    }

    [Fact]
    public async Task OwnCreateUnknownCommitKeepsBothPreparedDocumentsAndReceiptPreventsReplay()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var requestId = Guid.NewGuid();
        f.Store.AfterCommitFailure = new DbUpdateException("commit outcome unknown");
        var request = new CharacterCatalogCreateRequest
        {
            RequestId = requestId,
            Definition = OwnedDefinition("Uncertain", CatalogKind.Item, true, QuantityUnit.Whole, false, []),
            Quantity = 1m,
            Attributes = []
        };

        var unknown = await Error(() => f.Service.CreateOwnAsync(Member, 7, character, request, default));
        Assert.Equal(503, unknown.StatusCode);
        Assert.Equal("publication_outcome_unknown", unknown.Code);
        Assert.Equal<Guid?>(requestId, unknown.RequestId);
        using (var resource = JsonDocument.Parse(JsonSerializer.Serialize(unknown.ResourceId)))
        {
            Assert.Equal(requestId.ToString("D"), resource.RootElement.GetProperty("entryId").GetString());
            Assert.Equal(requestId.ToString("D"), resource.RootElement.GetProperty("catalogEntryId").GetString());
        }
        Assert.NotNull(f.Sheets.Content.GetData<CatalogContent>("catalogContents", 7, requestId));
        Assert.NotNull(f.Sheets.Content.GetData<CharacterCatalogContent>("characterCatalogContents", 7, requestId));
        var receipt = await f.Service.GetAdditionAsync(Member, 7, character, requestId, default);
        Assert.Equal(requestId, receipt.EntryId);
        Assert.Equal(requestId, receipt.CatalogEntryId);

        var writesBeforeReplay = f.Sheets.Content.WriteCount;
        Assert.Equal("addition_already_applied", (await Error(() => f.Service.CreateOwnAsync(Member, 7, character, request, default))).Code);
        Assert.Equal(writesBeforeReplay, f.Sheets.Content.WriteCount);
        Assert.Single(f.Store.Entries);
        Assert.Single(f.Store.Receipts);
    }

    [Fact]
    public async Task LocalOverridesUseIndependentRevisionAndLiveDefinitionFallbackWithoutMaterialization()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Power", "integer"));
        var attrId = Assert.Single(schema.Data.Definitions).Id;
        var occurrenceId = Guid.NewGuid();
        var source = CharacterCatalogTestFixture.Value(occurrenceId, attrId, "integer", 1, "1");
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole, attributes: [source]);
        var added = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 2m, []), default);
        var secondCharacter = await f.AddCharacterAsync(canWrite: true);
        var secondAdded = await f.Service.AddAsync(Member, 7, secondCharacter, AddRequest(Guid.NewGuid(), definition.Entry.Id, 1m, []), default);
        var recordId = added.Result.Entry.Record.Id;
        var explicitFallback = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 1m, [source]), default);
        Assert.True(explicitFallback.Created);
        Assert.NotEqual(recordId, explicitFallback.Result.Entry.Record.Id);
        Assert.Equal(3, f.Store.Entries.Count);
        Assert.Equal(2, f.Store.Entries.Count(x => x.CharacterId == character));
        Assert.Single(f.Store.Entries, x => x.CharacterId == secondCharacter);
        var readWrites = f.Sheets.Content.WriteCount;
        var initial = await f.Service.GetAsync(Member, 7, character, recordId, default);
        Assert.Equal("1", initial.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Empty(initial.ExplicitAttributes);
        Assert.Equal(1, initial.LocalContentRevision);
        Assert.Equal(readWrites, f.Sheets.Content.WriteCount);

        var sourceChanged = source with { Value = CharacterCatalogTestFixture.Json("2") };
        await f.Catalog.UpdateContentAsync(GlobalAdmin, 7, definition.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "Changed", Attributes = [sourceChanged] }, default);
        var live = await f.Service.GetAsync(Member, 7, character, recordId, default);
        Assert.Equal("2", live.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Equal(2m, live.Record.Quantity);
        Assert.Empty(live.ExplicitAttributes);
        Assert.Equal(1, live.LocalContentRevision);
        Assert.Equal(1, live.SchemaRevision);
        Assert.Equal(2, live.DefinitionContentRevision);
        Assert.Equal("2", (await f.Service.GetAsync(Member, 7, secondCharacter, secondAdded.Result.Entry.Record.Id, default)).EffectiveAttributes.Single().Value.GetRawText());
        var explicitLive = await f.Service.GetAsync(Member, 7, character, explicitFallback.Result.Entry.Record.Id, default);
        Assert.Equal("1", explicitLive.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Single(explicitLive.ExplicitAttributes);

        var local = sourceChanged with { Value = CharacterCatalogTestFixture.Json("3") };
        var localResponse = await f.Service.UpdateAttributesAsync(Member, 7, character, recordId,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [local] }, default);
        Assert.Equal("3", localResponse.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Equal("3", localResponse.ExplicitAttributes.Single().Value.GetRawText());
        Assert.Equal(2, localResponse.LocalContentRevision);
        Assert.Equal(1, localResponse.Record.MetadataRevision);

        var cleared = await f.Service.UpdateAttributesAsync(Member, 7, character, recordId,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 2, Attributes = [] }, default);
        Assert.Equal("2", cleared.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Equal("2", (await f.Service.GetAsync(Member, 7, secondCharacter, secondAdded.Result.Entry.Record.Id, default)).EffectiveAttributes.Single().Value.GetRawText());
        Assert.Empty(cleared.ExplicitAttributes);
        Assert.Equal(3, cleared.LocalContentRevision);
    }

    [Fact]
    public async Task StaleLocalValuesArePreservedDiagnosedAndCannotBeChangedUntilRetyped()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Trait", "integer"));
        var attributeId = Assert.Single(schema.Data.Definitions).Id;
        var occurrenceId = Guid.NewGuid();
        var source = CharacterCatalogTestFixture.Value(occurrenceId, attributeId, "integer", 1, "1");
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole, attributes: [source]);
        var record = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 1m, [source with { Value = CharacterCatalogTestFixture.Json("4") }]), default);
        var newSchema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7,
            new CatalogAttributesUpdateRequest { ExpectedRevision = 1, Definitions = [new CatalogAttributeDefinitionInput { Id = attributeId, Title = "Trait", TypeKey = "string", Options = [], IsActive = true }] }, default);
        Assert.Equal(2, Assert.Single(newSchema.Data.Definitions).TypeRevision);

        var staleRead = await f.Service.GetAsync(Member, 7, character, record.Result.Entry.Record.Id, default);
        Assert.Equal("4", staleRead.ExplicitAttributes.Single().Value.GetRawText());
        Assert.Contains(staleRead.Diagnostics, x => x.Code == "incompatible_attribute_type");
        Assert.Equal(2, staleRead.SchemaRevision);
        Assert.Equal(1, staleRead.DefinitionContentRevision);
        Assert.Equal(1, staleRead.LocalContentRevision);
        var unchanged = await f.Service.UpdateAttributesAsync(Member, 7, character, record.Result.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = staleRead.ExplicitAttributes }, default);
        Assert.Equal("4", unchanged.ExplicitAttributes.Single().Value.GetRawText());
        var contentWrites = f.Sheets.Content.WriteCount;
        Assert.Equal(400, (await Error(() => f.Service.UpdateAttributesAsync(Member, 7, character, record.Result.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 2, Attributes = [staleRead.ExplicitAttributes.Single() with { Value = CharacterCatalogTestFixture.Json("5") }] }, default))).StatusCode);
        Assert.Equal(contentWrites, f.Sheets.Content.WriteCount);

        var retyped = staleRead.ExplicitAttributes.Single() with { TypeKey = "string", TypeRevision = 2, Value = CharacterCatalogTestFixture.Json("\"new\"") };
        var updated = await f.Service.UpdateAttributesAsync(Member, 7, character, record.Result.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 2, Attributes = [retyped] }, default);
        Assert.Equal("\"new\"", updated.ExplicitAttributes.Single().Value.GetRawText());
        Assert.Equal(3, updated.LocalContentRevision);
    }

    [Fact]
    public async Task RetiredAndRemovedCatalogOccurrencesRemainAsExplicitCharacterValues()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("Trait", "integer"));
        var definition = schema.Data.Definitions.Single();
        var source = CharacterCatalogTestFixture.Value(Guid.NewGuid(), definition.Id, "integer", 1, "1");
        var entry = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole, attributes: [source]);
        var local = source with { Value = CharacterCatalogTestFixture.Json("7") };
        var added = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), entry.Entry.Id, 1m, [local]), default);

        await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 1,
            Definitions = [new CatalogAttributeDefinitionInput { Id = definition.Id, Title = definition.Title, TypeKey = definition.TypeKey, Options = [], IsActive = false }]
        }, default);
        var inactive = await f.Service.GetAsync(Member, 7, character, added.Result.Entry.Record.Id, default);
        Assert.Empty(inactive.Diagnostics);
        Assert.Equal("7", inactive.ExplicitAttributes.Single().Value.GetRawText());
        var preserved = await f.Service.UpdateAttributesAsync(Member, 7, character, added.Result.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [local] }, default);
        Assert.Equal("7", preserved.ExplicitAttributes.Single().Value.GetRawText());

        await f.Catalog.UpdateContentAsync(GlobalAdmin, 7, entry.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "Occurrence removed", Attributes = [] }, default);
        var removed = await f.Service.GetAsync(Member, 7, character, added.Result.Entry.Record.Id, default);
        Assert.Equal("7", removed.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Equal("7", removed.ExplicitAttributes.Single().Value.GetRawText());
    }

    [Fact]
    public async Task SourceBindingOrEditLevelChangesKeepLocalValueButCannotOverrideCurrentDefinition()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture.Definition("First", "integer"), CharacterCatalogTestFixture.Definition("Second", "string"));
        var firstId = schema.Data.Definitions.Single(x => x.Title == "First").Id;
        var secondId = schema.Data.Definitions.Single(x => x.Title == "Second").Id;
        var occurrenceId = Guid.NewGuid();
        var original = CharacterCatalogTestFixture.Value(occurrenceId, firstId, "integer", 1, "1");
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole, attributes: [original]);
        var added = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 1m, [original with { Value = CharacterCatalogTestFixture.Json("5") }]), default);
        var recordId = added.Result.Entry.Record.Id;

        var reboundSource = original with { AttributeId = secondId, TypeKey = "string", Value = CharacterCatalogTestFixture.Json("\"source\"") };
        await f.Catalog.UpdateContentAsync(GlobalAdmin, 7, definition.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "Binding changed", Attributes = [reboundSource] }, default);
        var bindingChanged = await f.Service.GetAsync(Member, 7, character, recordId, default);
        Assert.Equal("5", bindingChanged.ExplicitAttributes.Single().Value.GetRawText());
        Assert.Contains(bindingChanged.Diagnostics, x => x.Code == "attribute_binding_changed");
        Assert.Equal("\"source\"", bindingChanged.EffectiveAttributes.Single().Value.GetRawText());

        var localRebound = original with { AttributeId = secondId, TypeKey = "string", Value = CharacterCatalogTestFixture.Json("\"local\"") };
        await f.Service.UpdateAttributesAsync(Member, 7, character, recordId,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [localRebound] }, default);
        var definitionLevel = reboundSource with { Value = CharacterCatalogTestFixture.Json("\"new source\""), EditLevel = AttributeEditLevel.Definition };
        await f.Catalog.UpdateContentAsync(GlobalAdmin, 7, definition.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 2, Description = "Level changed", Attributes = [definitionLevel] }, default);
        var levelChanged = await f.Service.GetAsync(Member, 7, character, recordId, default);
        Assert.Contains(levelChanged.Diagnostics, x => x.Code == "edit_level_changed");
        Assert.Equal("\"new source\"", levelChanged.EffectiveAttributes.Single().Value.GetRawText());
        Assert.Equal("\"local\"", levelChanged.ExplicitAttributes.Single().Value.GetRawText());
    }

    [Fact]
    public async Task QuantityAndLocalContentRevisionsAreIndependentAndWritesUseOrderedLocks()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var added = await f.Service.AddAsync(Member, 7, character, AddRequest(Guid.NewGuid(), definition.Entry.Id, 2m, []), default);
        var entryId = added.Result.Entry.Record.Id;
        Assert.Equal(new[] { $"definition:{definition.Entry.Id}", $"character:{character}" }, f.Store.LockOrder.TakeLast(2));
        var contentWrites = f.Sheets.Content.WriteCount;
        var quantity = await f.Service.UpdateQuantityAsync(Member, 7, character, entryId,
            new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 4m }, default);
        Assert.Equal(4m, quantity.Record.Quantity);
        Assert.Equal(2, quantity.Record.MetadataRevision);
        Assert.Equal(contentWrites, f.Sheets.Content.WriteCount);
        Assert.Equal(new[] { $"definition:{definition.Entry.Id}", $"character:{character}" }, f.Store.LockOrder.TakeLast(2));
        var failedQuantity = await Error(() => f.Service.UpdateQuantityAsync(Member, 7, character, entryId,
            new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 5m }, default));
        Assert.Equal(409, failedQuantity.StatusCode);
        Assert.Equal(4m, f.Store.Entries.Single().Quantity);

        var local = await f.Service.UpdateAttributesAsync(Member, 7, character, entryId,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [] }, default);
        Assert.Equal(2, local.LocalContentRevision);
        Assert.Equal(2, local.Record.MetadataRevision);
        Assert.Equal(new[] { $"definition:{definition.Entry.Id}", $"character:{character}" }, f.Store.LockOrder.TakeLast(2));
        var replaceCount = f.Sheets.Content.ReplaceCount;
        Assert.Equal(409, (await Error(() => f.Service.UpdateAttributesAsync(Member, 7, character, entryId,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [] }, default))).StatusCode);
        Assert.Equal(replaceCount, f.Sheets.Content.ReplaceCount);
        var receiptsBeforeDelete = f.Store.Receipts.Count;
        Assert.Equal(409, (await Error(() => f.Service.DeleteAsync(Member, 7, character, entryId, 1, default))).StatusCode);
        Assert.Single(f.Store.Entries);
        Assert.Equal(receiptsBeforeDelete, f.Store.Receipts.Count);
        await f.Service.DeleteAsync(Member, 7, character, entryId, 2, default);
        Assert.Equal(new[] { $"definition:{definition.Entry.Id}", $"character:{character}" }, f.Store.LockOrder.TakeLast(2));
        Assert.Empty(f.Store.Entries);
        Assert.Single(f.Store.Receipts);
        Assert.NotNull(await f.CatalogStore.GetAsync(7, definition.Entry.Id, default));
    }

    [Fact]
    public async Task QuantityPolicyChangesRejectIncompatibleRowsAndAllowCompatibleChangesUnderDefinitionLock()
    {
        var fractionalFixture = CharacterCatalogTestFixture.Create();
        var fractionalCharacter = await fractionalFixture.AddCharacterAsync(canWrite: true);
        var fractional = await fractionalFixture.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Fractional);
        await fractionalFixture.Service.AddAsync(Member, 7, fractionalCharacter,
            AddRequest(Guid.NewGuid(), fractional.Entry.Id, 1.5m, []), default);
        var beforeUpdateCount = fractionalFixture.CatalogStore.UpdateCount;
        var wholeConflict = await Error(() => fractionalFixture.Catalog.UpdateMetadataAsync(GlobalAdmin, 7, fractional.Entry.Id,
            new CatalogMetadataUpdateRequest { Name = fractional.Entry.Name, QuantityUnit = QuantityUnit.Whole, ExpectedRevision = 1 }, default));
        Assert.Equal("quantity_policy_conflict", wholeConflict.Code);
        Assert.Equal(beforeUpdateCount, fractionalFixture.CatalogStore.UpdateCount);
        Assert.Equal(1.5m, fractionalFixture.Store.Entries.Single().Quantity);
        Assert.Equal(1, (await fractionalFixture.CatalogStore.GetAsync(7, fractional.Entry.Id, default))!.MetadataRevision);
        Assert.Equal(new[] { $"definition:{fractional.Entry.Id}" }, fractionalFixture.Store.LockOrder.TakeLast(1));

        var negativeFixture = CharacterCatalogTestFixture.Create();
        var negativeCharacter = await negativeFixture.AddCharacterAsync(canWrite: true);
        var negativeDefinition = await negativeFixture.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Fractional, allowNegative: true);
        await negativeFixture.Service.AddAsync(Member, 7, negativeCharacter, AddRequest(Guid.NewGuid(), negativeDefinition.Entry.Id, -2m, []), default);
        var negativeConflict = await Error(() => negativeFixture.Catalog.UpdateMetadataAsync(GlobalAdmin, 7, negativeDefinition.Entry.Id,
            new CatalogMetadataUpdateRequest { Name = negativeDefinition.Entry.Name, AllowNegative = false, ExpectedRevision = 1 }, default));
        Assert.Equal("quantity_policy_conflict", negativeConflict.Code);
        Assert.True((await negativeFixture.CatalogStore.GetAsync(7, negativeDefinition.Entry.Id, default))!.AllowNegative);
        Assert.Equal(-2m, negativeFixture.Store.Entries.Single().Quantity);

        var singleFixture = CharacterCatalogTestFixture.Create();
        var singleCharacter = await singleFixture.AddCharacterAsync(canWrite: true);
        var singleDefinition = await singleFixture.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Fractional);
        await singleFixture.Service.AddAsync(Member, 7, singleCharacter, AddRequest(Guid.NewGuid(), singleDefinition.Entry.Id, 2m, []), default);
        var singleConflict = await Error(() => singleFixture.Catalog.UpdateMetadataAsync(GlobalAdmin, 7, singleDefinition.Entry.Id,
            new CatalogMetadataUpdateRequest { Name = singleDefinition.Entry.Name, QuantityUnit = QuantityUnit.Single, ExpectedRevision = 1 }, default));
        Assert.Equal("quantity_policy_conflict", singleConflict.Code);
        Assert.Equal(2m, singleFixture.Store.Entries.Single().Quantity);

        var compatibleFixture = CharacterCatalogTestFixture.Create();
        var compatibleCharacter = await compatibleFixture.AddCharacterAsync(canWrite: true);
        var compatibleDefinition = await compatibleFixture.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        await compatibleFixture.Service.AddAsync(Member, 7, compatibleCharacter, AddRequest(Guid.NewGuid(), compatibleDefinition.Entry.Id, 2m, []), default);
        compatibleFixture.CatalogStore.BeforeUpdate = (_, _) => Assert.True(compatibleFixture.Store.InsideTransaction);
        var changed = await compatibleFixture.Catalog.UpdateMetadataAsync(GlobalAdmin, 7, compatibleDefinition.Entry.Id,
            new CatalogMetadataUpdateRequest { Name = compatibleDefinition.Entry.Name, QuantityUnit = QuantityUnit.Fractional, AllowNegative = true, ExpectedRevision = 1 }, default);
        Assert.Equal(2, changed.MetadataRevision);
        Assert.Equal(2m, compatibleFixture.Store.Entries.Single().Quantity);
    }

    [Fact]
    public async Task MissingPublishedMongoDocumentsReturn503AndInvalidKindOrValuesReturn400()
    {
        var f = CharacterCatalogTestFixture.Create();
        var character = await f.AddCharacterAsync(canWrite: true);
        Assert.Equal(400, (await Error(() => f.Service.ListAsync(Member, 7, character, (CatalogKind)8, default))).StatusCode);
        var missingDefinition = new CatalogEntry { Id = Guid.NewGuid(), CampaignId = 7, Name = "Missing content", Kind = CatalogKind.Item, QuantityUnit = QuantityUnit.Whole };
        await f.CatalogStore.CreateAsync(missingDefinition, default);
        f.Store.Entries.Add(new CharacterCatalogEntry { Id = Guid.NewGuid(), CampaignId = 7, CharacterId = character, CatalogEntryId = missingDefinition.Id, Quantity = 1m });
        Assert.Equal(503, (await Error(() => f.Service.GetAsync(Member, 7, character, f.Store.Entries.Single().Id, default))).StatusCode);
        var definition = await f.CreateDefinitionAsync(CatalogKind.Item, unit: QuantityUnit.Whole);
        var missingLocalId = Guid.NewGuid();
        f.Store.Entries.Add(new CharacterCatalogEntry { Id = missingLocalId, CampaignId = 7, CharacterId = character, CatalogEntryId = definition.Entry.Id, Quantity = 1m });
        Assert.Equal(503, (await Error(() => f.Service.GetAsync(Member, 7, character, missingLocalId, default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(Member, 7, character, Guid.NewGuid(), default))).StatusCode);

        f.Sheets.Campaigns.SeedCampaign(8);
        var foreignDefinitionId = Guid.NewGuid();
        f.CatalogStore.Entries.Add(new CatalogEntry { Id = foreignDefinitionId, CampaignId = 8, Name = "Foreign", Kind = CatalogKind.Item, QuantityUnit = QuantityUnit.Whole });
        var crossCampaignRecordId = Guid.NewGuid();
        f.Store.Entries.Add(new CharacterCatalogEntry { Id = crossCampaignRecordId, CampaignId = 7, CharacterId = character, CatalogEntryId = foreignDefinitionId, Quantity = 1m });
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(Member, 7, character, crossCampaignRecordId, default))).StatusCode);
    }

    [Fact]
    public void OwnerCreateRejectsForgedCreatorAndCharacterRequestProperties()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        const string request = "{\"requestId\":\"11111111-1111-1111-1111-111111111111\",\"definition\":{\"name\":\"x\",\"kind\":\"Item\",\"isHidden\":true,\"quantityUnit\":\"Whole\",\"allowNegative\":false,\"description\":\"\",\"attributes\":[],\"creatorUserId\":99},\"attributes\":[]}";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CharacterCatalogCreateRequest>(request, options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CharacterCatalogAddRequest>("{\"requestId\":\"11111111-1111-1111-1111-111111111111\",\"catalogEntryId\":\"22222222-2222-2222-2222-222222222222\",\"attributes\":[],\"price\":2}", options));
    }

    private static CharacterCatalogDefinitionInput OwnedDefinition(string name, CatalogKind kind, bool hidden, QuantityUnit? unit, bool allowNegative, CatalogAttributeValue[] attributes) => new()
    {
        Name = name, Kind = kind, IsHidden = hidden, QuantityUnit = unit, AllowNegative = allowNegative, Description = "Source description", Attributes = attributes
    };

    private static CharacterCatalogAddRequest AddRequest(Guid requestId, Guid catalogEntryId, decimal? quantity, CatalogAttributeValue[] attributes) => new()
    {
        RequestId = requestId, CatalogEntryId = catalogEntryId, Quantity = quantity, Attributes = attributes
    };

    private static async Task<DomainException> Error(Func<Task> action) => await Assert.ThrowsAsync<DomainException>(action);
}
