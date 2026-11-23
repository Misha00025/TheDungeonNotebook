using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public sealed class CharacterCatalogServiceTests
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task StackableItemsMergeByDefinitionPerCharacterWithoutLocalDocuments()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var characterA = await f.AddCharacterAsync();
        var characterB = await f.AddCharacterAsync();
        var definition = await f.CreateDefinitionAsync(unit: QuantityUnit.Whole);
        var firstB = await Add(f.Service, characterB, definition.Entry.Id, 2m);
        var firstA = await Add(f.Service, characterA, definition.Entry.Id, 4m);
        var mergedB = await Add(f.Service, characterB, definition.Entry.Id, 3m);
        var mergedA = await Add(f.Service, characterA, definition.Entry.Id, 1m);
        Assert.True(firstB.Created);
        Assert.True(firstA.Created);
        Assert.False(mergedB.Created);
        Assert.False(mergedA.Created);
        Assert.Equal(5m, mergedB.Result.Entry.Record.Quantity);
        Assert.Equal(5m, mergedA.Result.Entry.Record.Quantity);
        Assert.NotEqual(mergedA.Result.Entry.Record.Id, mergedB.Result.Entry.Record.Id);
        Assert.Equal(0, mergedA.Result.Entry.LocalContentRevision);
        Assert.Empty(mergedA.Result.Entry.ExplicitAttributes);
        Assert.Equal(0, mergedB.Result.Entry.LocalContentRevision);
        Assert.Equal(2, f.Store.Entries.Count);
        Assert.Throws<KeyNotFoundException>(() => f.Sheets.Content.GetData<CharacterCatalogContent>("characterItemContents", 7, mergedA.Result.Entry.Record.Id));
        Assert.Throws<KeyNotFoundException>(() => f.Sheets.Content.GetData<CharacterCatalogContent>("characterItemContents", 7, mergedB.Result.Entry.Record.Id));
    }

    [Fact]
    public async Task StackStateIsRejectedBeforeWritesAndSingleAddsAlwaysCreateSeparateRows()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture<ItemCatalog>.Definition("marker", "integer"));
        var attr = Assert.Single(schema.Data.Definitions).Id;
        var definitionValue = CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), attr, "3", AttributeEditLevel.Definition);
        var stack = await f.CreateDefinitionAsync(unit: QuantityUnit.Fractional, attributes: [definitionValue]);
        Assert.Equal(definitionValue.Value.GetRawText(), Assert.Single((await f.Catalog.GetContentAsync(Member, 7, stack.Entry.Id, default)).Data.Attributes).Value.GetRawText());
        var value = CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), attr, "3");
        var contentWrites = f.Sheets.Content.WriteCount;
        var sqlWrites = f.Store.WriteAttempts;
        var error = await Error(() => f.Service.AddAsync(Member, 7, character, Request(Guid.NewGuid(), stack.Entry.Id, 1m, [value]), default));
        Assert.Equal("stack_state_not_supported", error.Code);
        Assert.Equal(contentWrites, f.Sheets.Content.WriteCount);
        Assert.Equal(sqlWrites, f.Store.WriteAttempts);

        var attachedStack = await Add(f.Service, character, stack.Entry.Id, 1m);
        var existingStackError = await Error(() => f.Service.UpdateAttributesAsync(Member, 7, character, attachedStack.Result.Entry.Record.Id,
            new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [value] }, default));
        Assert.Equal(400, existingStackError.StatusCode);
        Assert.Equal("stack_state_not_supported", existingStackError.Code);
        var beforeOwnCreateContent = f.Sheets.Content.WriteCount;
        var beforeOwnCreateSql = f.Store.WriteAttempts;
        var ownCreateError = await Error(() => f.Service.CreateOwnAsync(Member, 7, character, new CharacterCatalogCreateRequest
        {
            RequestId = Guid.NewGuid(),
            Definition = new CharacterCatalogDefinitionInput
            {
                Name = "owned stack", IsHidden = true, QuantityUnit = QuantityUnit.Fractional,
                AllowNegative = false, Description = "source attributes remain legal", Attributes = [definitionValue]
            },
            Quantity = 1,
            Attributes = [value]
        }, default));
        Assert.Equal(400, ownCreateError.StatusCode);
        Assert.Equal("stack_state_not_supported", ownCreateError.Code);
        Assert.Equal(beforeOwnCreateContent, f.Sheets.Content.WriteCount);
        Assert.Equal(beforeOwnCreateSql, f.Store.WriteAttempts);

        var single = await f.CreateDefinitionAsync(unit: QuantityUnit.Single);
        var first = await Add(f.Service, character, single.Entry.Id, 1m, [value]);
        var same = await Add(f.Service, character, single.Entry.Id, 1m, [value]);
        var other = await Add(f.Service, character, single.Entry.Id, 1m, [value with { Value = CharacterCatalogTestFixture<ItemCatalog>.Json("4") }]);
        Assert.True(first.Created);
        Assert.True(same.Created);
        Assert.True(other.Created);
        Assert.Equal(4, (await f.Service.ListAsync(Member, 7, character, default)).Count);
        Assert.All((await f.Service.ListAsync(Member, 7, character, default)).Where(x => x.Definition.Id == single.Entry.Id), x => Assert.Equal(1m, x.Record.Quantity));
    }

    [Fact]
    public async Task SkillsAlwaysHaveNullQuantityAndEveryAddGetsSeparateLocalDocument()
    {
        var f = CharacterCatalogTestFixture<SkillCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture<SkillCatalog>.Definition("rank", "integer"));
        var attr = Assert.Single(schema.Data.Definitions).Id;
        var definition = await f.CreateDefinitionAsync();
        var value = CharacterCatalogTestFixture<SkillCatalog>.Value(Guid.NewGuid(), attr, "2");
        var first = await Add(f.Service, character, definition.Entry.Id, null, [value]);
        var identical = await Add(f.Service, character, definition.Entry.Id, null, [value]);
        var different = await Add(f.Service, character, definition.Entry.Id, null, [value with { Value = CharacterCatalogTestFixture<SkillCatalog>.Json("3") }]);
        var empty = await Add(f.Service, character, definition.Entry.Id, null, []);
        Assert.All(new[] { first, identical, different, empty }, x => { Assert.True(x.Created); Assert.Null(x.Result.Entry.Record.Quantity); });
        Assert.Equal(4, (await f.Service.ListAsync(Member, 7, character, default)).Count);
        Assert.All(new[] { first, identical, different, empty }, x => Assert.Equal(1, x.Result.Entry.LocalContentRevision));
        Assert.Equal(400, (await Error(() => Add(f.Service, character, definition.Entry.Id, 1m))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.UpdateQuantityAsync(Member, 7, character, first.Result.Entry.Record.Id, new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 1 }, default))).StatusCode);
    }

    [Fact]
    public async Task QuantityPolicyValidationCasAndUnitTransitionsPreserveRows()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var whole = await f.CreateDefinitionAsync(unit: QuantityUnit.Whole);
        var row = await Add(f.Service, character, whole.Entry.Id, 0m);
        Assert.Equal(0m, row.Result.Entry.Record.Quantity);
        Assert.Equal(400, (await Error(() => Add(f.Service, character, whole.Entry.Id, 0.5m))).StatusCode);
        Assert.Equal(400, (await Error(() => Add(f.Service, character, whole.Entry.Id, -1m))).StatusCode);
        var unitChanged = await Error(() => f.Catalog.UpdateMetadataAsync(Admin, 7, whole.Entry.Id, new CatalogMetadataUpdateRequest { Name = whole.Entry.Name, QuantityUnit = QuantityUnit.Single, ExpectedRevision = 1 }, default));
        Assert.Equal("quantity_policy_conflict", unitChanged.Code);
        Assert.Equal(QuantityUnit.Whole, (await f.Catalog.GetAsync(Admin, 7, whole.Entry.Id, default)).QuantityUnit);
        var negative = await f.CreateDefinitionAsync(unit: QuantityUnit.Fractional, allowNegative: true);
        var fractional = await Add(f.Service, character, negative.Entry.Id, 0.1m);
        var summed = await Add(f.Service, character, negative.Entry.Id, 0.2m);
        Assert.Equal(0.3m, summed.Result.Entry.Record.Quantity);
        var minus = await Add(f.Service, character, negative.Entry.Id, -0.4m);
        Assert.Equal(-0.1m, minus.Result.Entry.Record.Quantity);
        var current = await f.Service.GetAsync(Member, 7, character, fractional.Result.Entry.Record.Id, default);
        var update = await f.Service.UpdateQuantityAsync(Member, 7, character, fractional.Result.Entry.Record.Id, new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = current.Record.MetadataRevision, Quantity = 0m }, default);
        Assert.Equal(0m, update.Record.Quantity);
        Assert.Equal(409, (await Error(() => f.Service.UpdateQuantityAsync(Member, 7, character, fractional.Result.Entry.Record.Id, new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 2m }, default))).StatusCode);
        await f.Service.DeleteAsync(Member, 7, character, fractional.Result.Entry.Record.Id, update.Record.MetadataRevision, default);
        Assert.Single(f.Store.Entries);
    }

    [Fact]
    public async Task RepeatedRequestIdDoesNotAddQuantityAgainAndReceiptSurvivesDeletion()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var definition = await f.CreateDefinitionAsync(unit: QuantityUnit.Whole);
        var first = await Add(f.Service, character, definition.Entry.Id, 2m);
        var repeat = await Error(() => f.Service.AddAsync(Member, 7, character, Request(first.Result.RequestId, definition.Entry.Id, 2m), default));
        Assert.Equal("addition_already_applied", repeat.Code);
        Assert.Equal(2m, (await f.Service.GetAsync(Member, 7, character, first.Result.Entry.Record.Id, default)).Record.Quantity);

        var receipt = await f.Service.GetAdditionAsync(Member, 7, character, first.Result.RequestId, default);
        Assert.Equal(first.Result.Entry.Record.Id, receipt.EntryId);
        Assert.Equal(2m, (await f.Service.GetAsync(Member, 7, character, first.Result.Entry.Record.Id, default)).Record.Quantity);
        await f.Service.DeleteAsync(Member, 7, character, first.Result.Entry.Record.Id, first.Result.Entry.Record.MetadataRevision, default);
        Assert.Equal(first.Result.Entry.Record.Id, (await f.Service.GetAdditionAsync(Member, 7, character, first.Result.RequestId, default)).EntryId);
        Assert.Single(f.Store.Receipts);
    }

    [Fact]
    public async Task HiddenAttachedDefinitionsRemainReadableButHiddenNewAddsAreNotFound()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var hidden = await f.CreateDefinitionAsync(hidden: true, unit: QuantityUnit.Single);
        var attached = await Add(f.Service, character, hidden.Entry.Id, 1m, subject: Admin);
        Assert.True((await f.Service.GetAsync(Member, 7, character, attached.Result.Entry.Record.Id, default)).Definition.IsHidden);
        Assert.Equal(404, (await Error(() => Add(f.Service, character, hidden.Entry.Id, 1m))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(Member, 8, character, attached.Result.Entry.Record.Id, default))).StatusCode);
    }

    [Fact]
    public async Task CharacterReadOnlyAssignmentAllowsReadsButBlocksEveryCharacterWriteBeforePersistence()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync(canWrite: false);
        var definition = await f.CreateDefinitionAsync(unit: QuantityUnit.Single);
        var attached = await Add(f.Service, character, definition.Entry.Id, 1m, subject: Admin);
        var sqlWrites = f.Store.WriteAttempts;
        var mongoWrites = f.Sheets.Content.WriteCount;

        Assert.Single(await f.Service.ListAsync(Member, 7, character, default));
        Assert.Equal(403, (await Error(() => Add(f.Service, character, definition.Entry.Id, 1m))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.UpdateQuantityAsync(Member, 7, character, attached.Result.Entry.Record.Id, new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 1 }, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.UpdateAttributesAsync(Member, 7, character, attached.Result.Entry.Record.Id, new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [] }, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.DeleteAsync(Member, 7, character, attached.Result.Entry.Record.Id, 1, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.CreateOwnAsync(Member, 7, character, new CharacterCatalogCreateRequest
        {
            RequestId = Guid.NewGuid(),
            Definition = new CharacterCatalogDefinitionInput { Name = "read-only own", IsHidden = true, QuantityUnit = QuantityUnit.Single, AllowNegative = false, Description = "", Attributes = [] },
            Quantity = 1,
            Attributes = []
        }, default))).StatusCode);
        Assert.Equal(sqlWrites, f.Store.WriteAttempts);
        Assert.Equal(mongoWrites, f.Sheets.Content.WriteCount);
    }

    [Fact]
    public async Task WritableCharacterCanCreateHiddenOwnedDefinitionAndCampaignAdminCanPublishIt()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var requestId = Guid.NewGuid();
        var writesBeforePublicOwnCreate = f.Sheets.Content.WriteCount;
        var sqlBeforePublicOwnCreate = f.Store.WriteAttempts;
        var publicOwnError = await Error(() => f.Service.CreateOwnAsync(Member, 7, character, new CharacterCatalogCreateRequest
        {
            RequestId = Guid.NewGuid(),
            Definition = new CharacterCatalogDefinitionInput { Name = "public own", IsHidden = false, QuantityUnit = QuantityUnit.Single, AllowNegative = false, Description = "", Attributes = [] },
            Quantity = 1,
            Attributes = []
        }, default));
        Assert.Equal(403, publicOwnError.StatusCode);
        Assert.Equal(writesBeforePublicOwnCreate, f.Sheets.Content.WriteCount);
        Assert.Equal(sqlBeforePublicOwnCreate, f.Store.WriteAttempts);
        var created = await f.Service.CreateOwnAsync(Member, 7, character, new CharacterCatalogCreateRequest
        {
            RequestId = requestId,
            Definition = new CharacterCatalogDefinitionInput
            {
                Name = "owned", IsHidden = true, QuantityUnit = QuantityUnit.Single, AllowNegative = false,
                Description = "owned description", Attributes = []
            },
            Quantity = 1,
            Attributes = []
        }, default);
        Assert.Equal(requestId, created.RequestId);
        Assert.Equal(200, created.Entry.Definition.CreatorUserId);
        Assert.True(created.Entry.Definition.IsHidden);
        Assert.Equal("owned", (await f.Catalog.GetAsync(Member, 7, requestId, default)).Name);
        Assert.Equal("owned", (await f.Catalog.GetAsync(new Subject(SubjectType.Admin, 9), 7, requestId, default)).Name);
        var published = await f.Catalog.UpdateMetadataAsync(new Subject(SubjectType.Admin, 9), 7, requestId,
            new CatalogMetadataUpdateRequest { Name = "owned", IsHidden = false, ExpectedRevision = 1 }, default);
        Assert.False(published.IsHidden);
    }

    [Fact]
    public async Task LocalOverridesUseCurrentSource()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture<ItemCatalog>.Definition("trait", "integer"));
        var attr = Assert.Single(schema.Data.Definitions).Id;
        var source = CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), attr, "1", AttributeEditLevel.Character);
        var definition = await f.CreateDefinitionAsync(unit: QuantityUnit.Single, attributes: [source]);
        var added = await Add(f.Service, character, definition.Entry.Id, 1m);
        Assert.Equal("1", Assert.Single(added.Result.Entry.EffectiveAttributes).Value.GetRawText());
        var local = source with { Value = CharacterCatalogTestFixture<ItemCatalog>.Json("0") };
        var overridden = await f.Service.UpdateAttributesAsync(Member, 7, character, added.Result.Entry.Record.Id, new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [local] }, default);
        Assert.Equal("0", Assert.Single(overridden.EffectiveAttributes).Value.GetRawText());
    }

    [Fact]
    public async Task RequestIdsAreIndependentByCatalogScope()
    {
        var sheets = SheetServiceTests.CreateFixture();
        var items = CharacterCatalogTestFixture<ItemCatalog>.Create(sheets);
        var skills = CharacterCatalogTestFixture<SkillCatalog>.Create(sheets);
        var character = await items.AddCharacterAsync();
        var item = await items.CreateDefinitionAsync(unit: QuantityUnit.Whole);
        var skill = await skills.CreateDefinitionAsync();
        var requestId = Guid.NewGuid();
        var itemAdd = await items.Service.AddAsync(Member, 7, character, Request(requestId, item.Entry.Id, 1m), default);
        var skillAdd = await skills.Service.AddAsync(Member, 7, character, Request(requestId, skill.Entry.Id, null), default);
        Assert.Equal(requestId, itemAdd.Result.RequestId);
        Assert.Equal(requestId, skillAdd.Result.RequestId);
        Assert.Single(items.Store.Receipts);
        Assert.Single(skills.Store.Receipts);

    }

    private static Task<(CharacterCatalogAddResponse Result, bool Created)> Add<T>(CharacterCatalogService<T> service, Guid character, Guid definitionId, decimal? quantity, CatalogAttributeValue[]? attributes = null, Subject? subject = null) where T : ICatalogType =>
        service.AddAsync(subject ?? Member, 7, character, Request(Guid.NewGuid(), definitionId, quantity, attributes), default);

    private static CharacterCatalogAddRequest Request(Guid request, Guid catalogEntry, decimal? quantity, CatalogAttributeValue[]? attributes = null) => new() { RequestId = request, CatalogEntryId = catalogEntry, Quantity = quantity, Attributes = attributes ?? [] };
    private static async Task<DomainException> Error(Func<Task> action) => await Assert.ThrowsAsync<DomainException>(action);
}
