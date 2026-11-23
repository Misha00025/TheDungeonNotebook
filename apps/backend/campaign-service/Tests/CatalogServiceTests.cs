using System.Text.Json;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public sealed class CatalogServiceTests
{
    private static readonly Subject GlobalAdmin = new(SubjectType.Admin, 9);
    private static readonly Subject CampaignAdmin = new(SubjectType.User, 100);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task ItemAndSkillScopesHaveIndependentSchemasDefinitionsGroupsAndRequestIds()
    {
        var item = Create<ItemCatalog>();
        var skill = Create<SkillCatalog>(item.Sheets);
        var id = Guid.NewGuid();
        Assert.Equal(0, (await skill.Service.GetAttributesAsync(Member, 7, default)).ContentRevision);
        var itemSchema = await item.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0, Def(null, "Item trait", "string")), default);
        var skillSchema = await skill.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0, Def(null, "Skill trait", "integer")), default);
        Assert.NotEqual(Assert.Single(itemSchema.Data.Definitions).Id, Assert.Single(skillSchema.Data.Definitions).Id);
        Assert.Equal(1, itemSchema.ContentRevision);
        Assert.Equal(1, skillSchema.ContentRevision);
        var itemCreated = await item.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(id, "Same id", QuantityUnit.Whole, false, []), default);
        var skillCreated = await skill.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(id, "Same id", null, false, []), default);
        Assert.Equal(id, itemCreated.Entry.Id);
        Assert.Equal(id, skillCreated.Entry.Id);
        Assert.Equal(1, itemCreated.Content.ContentRevision);
        Assert.Equal(1, skillCreated.Content.ContentRevision);
        Assert.NotNull(item.Sheets.Content.GetData<CatalogContent>("itemContents", 7, id));
        Assert.NotNull(item.Sheets.Content.GetData<CatalogContent>("skillContents", 7, id));

        var itemGroup = await item.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, new CatalogGroupsUpdateRequest { ExpectedRevision = 0, Groups = [new() { Title = "Items", EntryIds = [id] }] }, default);
        var skillGroup = await skill.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, new CatalogGroupsUpdateRequest { ExpectedRevision = 0, Groups = [new() { Title = "Skills", EntryIds = [id] }] }, default);
        Assert.NotEqual(Assert.Single(itemGroup.Data.Groups).Id, Assert.Single(skillGroup.Data.Groups).Id);
        Assert.Equal(1, itemGroup.ContentRevision);
        Assert.Equal(1, skillGroup.ContentRevision);
    }

    [Fact]
    public async Task SchemasSupportNativeTypesAndChoiceOptions()
    {
        var f = Create<ItemCatalog>();
        var schema = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0,
            Def(null, "integer", "integer"), Def(null, "number", "number"), Def(null, "string", "string"), Def(null, "boolean", "boolean"),
            Def(null, "single", "singleChoice", [new("a", "A"), new("rare", "Rare")]), Def(null, "multi", "multiChoice", [new("a", "A"), new("b", "B")])), default);
        var ids = schema.Data.Definitions.ToDictionary(x => x.Title, x => x.Id);
        var values = new[]
        {
            Value(ids["integer"], "9007199254740993"), Value(ids["number"], "-1.25"), Value(ids["string"], "\"\""),
            Value(ids["boolean"], "false"), Value(ids["single"], "\"rare\""), Value(ids["multi"], "[\"b\",\"a\"]"), Value(ids["multi"], "[]")
        };
        var result = await f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(Guid.NewGuid(), "native", QuantityUnit.Single, false, values), default);
        Assert.Equal("9007199254740993", result.Content.Data.Attributes.Single(x => x.AttributeId == ids["integer"]).Value.GetRawText());
        Assert.Equal("false", result.Content.Data.Attributes.Single(x => x.AttributeId == ids["boolean"]).Value.GetRawText());
        Assert.Equal(2, result.Content.Data.Attributes.Count(x => x.AttributeId == ids["multi"]));

    }

    [Fact]
    public async Task SchemaOmissionAndDeleteRemoveIdentityAndTypeChangesDoNotVersionValues()
    {
        var f = Create<ItemCatalog>();
        var initial = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0,
            Def(null, "choice", "singleChoice", [new("common", "Common"), new("rare", "Rare"), new("new", "New")]), Def(null, "count", "integer")), default);
        var choice = initial.Data.Definitions.Single(x => x.Title == "choice");
        var count = initial.Data.Definitions.Single(x => x.Title == "count");
        var common = Value(choice.Id, "\"common\"");
        var integer = Value(count.Id, "9007199254740993");
        var created = await f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(Guid.NewGuid(), "definition", QuantityUnit.Single, false, [common, integer]), default);
        var changed = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(1,
            Def(choice.Id, "choice", "singleChoice", [new("common", "Common"), new("new", "New")]), Def(count.Id, "count", "string")), default);
        Assert.Equal(2, changed.ContentRevision);
        var retained = (await f.Service.GetContentAsync(Member, 7, created.Entry.Id, default)).Data.Attributes;
        Assert.Equal(2, retained.Length);
        Assert.Equal("\"common\"", retained.Single(x => x.Id == common.Id).Value.GetRawText());
        Assert.Equal("9007199254740993", retained.Single(x => x.Id == integer.Id).Value.GetRawText());
        var commonChanged = await f.Service.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "updated", Attributes = [common with { Value = Json("\"new\"") }, integer] }, default);
        Assert.Equal(2, commonChanged.ContentRevision);
        Assert.Equal("\"new\"", commonChanged.Data.Attributes.Single(x => x.Id == common.Id).Value.GetRawText());

        var removed = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(2), default);
        Assert.Empty(removed.Data.Definitions);
        Assert.Empty((await f.Service.GetContentAsync(Member, 7, created.Entry.Id, default)).Data.Attributes);
        var replacement = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(3, Def(null, "choice", "singleChoice", [new("rare", "Rare")])), default);
        Assert.NotEqual(choice.Id, Assert.Single(replacement.Data.Definitions).Id);
        Assert.Empty((await f.Service.GetContentAsync(Member, 7, created.Entry.Id, default)).Data.Attributes);
        Assert.Equal(2, (await f.Service.GetContentAsync(Member, 7, created.Entry.Id, default)).ContentRevision);
    }

    [Fact]
    public async Task AttributeDeletionFiltersReadsWithoutWritesAndPrunesOnlyOnObjectWrites()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var character = await f.AddCharacterAsync();
        var schema = await f.DefineSchemaAsync(Def(null, "removed", "integer"), Def(null, "kept", "string"));
        var removed = schema.Data.Definitions.Single(x => x.Title == "removed").Id;
        var kept = schema.Data.Definitions.Single(x => x.Title == "kept").Id;
        var sourceGone = Value(removed, "7", AttributeEditLevel.Definition);
        var sourceKept = Value(kept, "\"yes\"", AttributeEditLevel.Definition);
        var created = await f.CreateDefinitionAsync(unit: QuantityUnit.Single, attributes: [sourceGone, sourceKept]);
        var attachedGone = await f.Service.AddAsync(GlobalAdmin, 7, character, new CharacterCatalogAddRequest { RequestId = Guid.NewGuid(), CatalogEntryId = created.Entry.Id, Attributes = [] }, default);
        var attachedKept = await f.Service.AddAsync(GlobalAdmin, 7, character, new CharacterCatalogAddRequest { RequestId = Guid.NewGuid(), CatalogEntryId = created.Entry.Id, Attributes = [] }, default);
        var metadataPrune = await f.CreateDefinitionAsync(unit: QuantityUnit.Single, attributes: [sourceGone, sourceKept], name: "metadata prune");
        var localGone = Value(removed, "8");
        var localKept = Value(kept, "\"local\"");
        await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, character, attachedGone.Result.Entry.Record.Id, new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [localGone, localKept] }, default);
        await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, character, attachedKept.Result.Entry.Record.Id, new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 1, Attributes = [localGone, localKept] }, default);
        var group = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, new CatalogGroupsUpdateRequest { ExpectedRevision = 0, Groups = [new() { Title = "group", EntryIds = [created.Entry.Id], Condition = new CatalogGroupCondition { Operator = "exists", AttributeId = removed } }] }, default);

        var rawSource = f.Sheets.Content.GetData<CatalogContent>("itemContents", 7, created.Entry.Id);
        var rawLocal = f.Sheets.Content.GetData<CharacterCatalogContent>("characterItemContents", 7, attachedGone.Result.Entry.Record.Id);
        var delete = await f.Catalog.DeleteAttributeAsync(GlobalAdmin, 7, removed, schema.ContentRevision, default);
        Assert.Equal(2, delete.ContentRevision);
        var transactionsBeforeReads = f.Store.TransactionCount;
        var contentWritesBeforeReads = f.Sheets.Content.WriteCount;
        var read = await f.Catalog.GetContentAsync(Member, 7, created.Entry.Id, default);
        var characterRead = await f.Service.GetAsync(Member, 7, character, attachedGone.Result.Entry.Record.Id, default);
        var characterList = await f.Service.ListAsync(Member, 7, character, default);
        var groupRead = await f.Groups.GetConfigurationAsync(GlobalAdmin, 7, default);
        Assert.DoesNotContain(read.Data.Attributes, x => x.AttributeId == removed);
        Assert.DoesNotContain(characterRead.ExplicitAttributes, x => x.AttributeId == removed);
        Assert.DoesNotContain(characterRead.EffectiveAttributes, x => x.AttributeId == removed);
        Assert.Equal(2, characterList.Count);
        Assert.All(characterList, entry => Assert.DoesNotContain(entry.EffectiveAttributes, x => x.AttributeId == removed));
        Assert.Null(Assert.Single(groupRead.Data.Groups).Condition);
        Assert.Equal(contentWritesBeforeReads, f.Sheets.Content.WriteCount);
        Assert.Equal(transactionsBeforeReads, f.Store.TransactionCount);
        Assert.Equal(rawSource, f.Sheets.Content.GetData<CatalogContent>("itemContents", 7, created.Entry.Id));
        Assert.Equal(rawLocal, f.Sheets.Content.GetData<CharacterCatalogContent>("characterItemContents", 7, attachedGone.Result.Entry.Record.Id));
        Assert.DoesNotContain((await f.Catalog.GetDefinitionContentForCharacterAsync(7, created.Entry.Id, default)).Data.Attributes, x => x.AttributeId == removed);

        var echo = await f.Catalog.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id, new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "prune", Attributes = [sourceGone, sourceKept] }, default);
        Assert.Single(echo.Data.Attributes);
        Assert.Equal(kept, Assert.Single(echo.Data.Attributes).AttributeId);
        await f.Catalog.UpdateMetadataAsync(GlobalAdmin, 7, metadataPrune.Entry.Id, new CatalogMetadataUpdateRequest { Name = "metadata prune", ExpectedRevision = 1 }, default);
        Assert.Single(f.Sheets.Content.GetData<CatalogContent>("itemContents", 7, metadataPrune.Entry.Id).Attributes);
        await f.Service.UpdateQuantityAsync(GlobalAdmin, 7, character, attachedGone.Result.Entry.Record.Id, new CharacterCatalogQuantityUpdateRequest { ExpectedRevision = 1, Quantity = 1 }, default);
        Assert.Single(f.Sheets.Content.GetData<CharacterCatalogContent>("characterItemContents", 7, attachedGone.Result.Entry.Record.Id).Attributes);
        var local = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, character, attachedKept.Result.Entry.Record.Id, new CharacterCatalogAttributesUpdateRequest { ExpectedRevision = 2, Attributes = [localGone, localKept] }, default);
        Assert.Equal(kept, Assert.Single(local.ExplicitAttributes).AttributeId);
        Assert.Equal(3, local.LocalContentRevision);
        Assert.Single(f.Sheets.Content.GetData<CharacterCatalogContent>("characterItemContents", 7, attachedKept.Result.Entry.Record.Id).Attributes);
        var groupEntries = (await f.Groups.GetEntriesAsync(Member, 7, group.Data.Groups.Single().Id, default)).Entries;
        Assert.Equal(created.Entry.Id, Assert.Single(groupEntries).Id);
        Assert.Equal(400, (await Error(() => f.Catalog.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id, new CatalogContentUpdateRequest { ExpectedRevision = 2, Description = "invalid", Attributes = [sourceKept, CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), removed, "9")] }, default))).StatusCode);
    }

    [Fact]
    public async Task CatalogPublicationVisibilityCasAndAccessGuardsRemainScoped()
    {
        var f = Create<ItemCatalog>();
        Assert.Equal(403, (await Error(() => f.Service.GetAttributesAsync(null, 7, default))).StatusCode);
        Assert.Equal(0, (await f.Service.GetAttributesAsync(Member, 7, default)).ContentRevision);
        Assert.Equal(403, (await Error(() => f.Service.UpdateAttributesAsync(Member, 7, SchemaRequest(0), default))).StatusCode);
        var created = await f.Service.CreateAsync(CampaignAdmin, 7, CreateRequest(Guid.NewGuid(), "private", QuantityUnit.Whole, false, [], true), default);
        Assert.Equal<int?>(100, created.Entry.CreatorUserId);
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(Member, 7, created.Entry.Id, default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.UpdateMetadataAsync(Member, 7, created.Entry.Id, new CatalogMetadataUpdateRequest { Name = "no", ExpectedRevision = 1 }, default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.UpdateMetadataAsync(CampaignAdmin, 7, created.Entry.Id, new CatalogMetadataUpdateRequest { Name = "stale", ExpectedRevision = 0 }, default))).StatusCode);
        var updated = await f.Service.UpdateMetadataAsync(CampaignAdmin, 7, created.Entry.Id, new CatalogMetadataUpdateRequest { Name = "renamed", ExpectedRevision = 1 }, default);
        Assert.Equal(2, updated.MetadataRevision);
        Assert.Equal(409, (await Error(() => f.Service.UpdateMetadataAsync(CampaignAdmin, 7, created.Entry.Id, new CatalogMetadataUpdateRequest { Name = "stale", ExpectedRevision = 1 }, default))).StatusCode);
        Assert.Equal("renamed", (await f.Service.GetAsync(CampaignAdmin, 7, created.Entry.Id, default)).Name);
        var gmPublished = await f.Service.UpdateMetadataAsync(CampaignAdmin, 7, created.Entry.Id,
            new CatalogMetadataUpdateRequest { Name = "renamed", IsHidden = false, ExpectedRevision = 2 }, default);
        Assert.False(gmPublished.IsHidden);

        var characterCatalog = CharacterCatalogTestFixture<ItemCatalog>.Create(f.Sheets);
        var character = await characterCatalog.AddCharacterAsync();
        var ownedId = Guid.NewGuid();
        var owned = await characterCatalog.Service.CreateOwnAsync(Member, 7, character, new CharacterCatalogCreateRequest
        {
            RequestId = ownedId,
            Definition = new CharacterCatalogDefinitionInput
            {
                Name = "author private", IsHidden = true, QuantityUnit = QuantityUnit.Single,
                AllowNegative = false, Description = "before", Attributes = []
            },
            Quantity = 1,
            Attributes = []
        }, default);
        Assert.Equal(ownedId, owned.Entry.Definition.Id);
        var authorContent = await characterCatalog.Catalog.UpdateContentAsync(Member, 7, ownedId,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "own hidden content", Attributes = [] }, default);
        Assert.Equal("own hidden content", authorContent.Data.Description);
        var authorMetadata = await characterCatalog.Catalog.UpdateMetadataAsync(Member, 7, ownedId,
            new CatalogMetadataUpdateRequest { Name = "author private edited", ExpectedRevision = 1 }, default);
        Assert.Equal(2, authorMetadata.MetadataRevision);
        var authorCannotPublish = await Error(() => characterCatalog.Catalog.UpdateMetadataAsync(Member, 7, ownedId,
            new CatalogMetadataUpdateRequest { Name = "author private edited", IsHidden = false, ExpectedRevision = 2 }, default));
        Assert.Equal(403, authorCannotPublish.StatusCode);
        var publicOther = await f.Service.CreateAsync(CampaignAdmin, 7, CreateRequest(Guid.NewGuid(), "public other", QuantityUnit.Whole, false, []), default);
        Assert.Equal(403, (await Error(() => f.Service.UpdateMetadataAsync(Member, 7, publicOther.Entry.Id, new CatalogMetadataUpdateRequest { Name = "no", ExpectedRevision = 1 }, default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(new Subject(SubjectType.Group, 8), 7, created.Entry.Id, default))).StatusCode);
    }

    private static Fixture<T> Create<T>(SheetServiceTests.Fixture? shared = null) where T : ICatalogType
    {
        var sheets = shared ?? SheetServiceTests.CreateFixture();
        var store = new FakeCatalogStore<T>();
        var records = new FakeCharacterCatalogStore<T>(store, (_, _) => true, store);
        var campaigns = new Tdn.Campaigns.Campaigns.CampaignService(sheets.Campaigns);
        var service = new CatalogService<T>(campaigns, store, sheets.Content, records);
        return new Fixture<T>(sheets, store, records, service, new CatalogGroupService<T>(campaigns, service, store, sheets.Content));
    }

    private static CatalogAttributesUpdateRequest SchemaRequest(long revision, params CatalogAttributeDefinitionInput[] definitions) => new() { ExpectedRevision = revision, Definitions = definitions };
    private static CatalogAttributeDefinitionInput Def(Guid? id, string title, string type, ChoiceOption[]? options = null) => CharacterCatalogTestFixture<ItemCatalog>.Definition(title, type, options, id);
    private static CatalogAttributeValue Value(Guid attributeId, string json, AttributeEditLevel level = AttributeEditLevel.Character) => CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), attributeId, json, level);
    private static CatalogCreateRequest CreateRequest(Guid id, string name, QuantityUnit? unit, bool negative, CatalogAttributeValue[] attributes, bool hidden = false) => new()
    {
        RequestId = id, Name = name, IsHidden = hidden, QuantityUnit = unit, AllowNegative = negative, Description = "", Attributes = attributes
    };
    private static JsonElement Json(string json) { using var document = JsonDocument.Parse(json); return document.RootElement.Clone(); }
    private static async Task<DomainException> Error(Func<Task> action) => await Assert.ThrowsAsync<DomainException>(action);
    private sealed record Fixture<T>(SheetServiceTests.Fixture Sheets, FakeCatalogStore<T> Store, FakeCharacterCatalogStore<T> Records, CatalogService<T> Service, CatalogGroupService<T> Groups) where T : ICatalogType;
}
