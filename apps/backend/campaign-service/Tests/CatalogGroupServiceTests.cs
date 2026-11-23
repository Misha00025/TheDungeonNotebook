using System.Text.Json;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public sealed class CatalogGroupServiceTests
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task ItemAndSkillGroupsHaveIndependentTreesMembershipAndRevisions()
    {
        var sheets = SheetServiceTests.CreateFixture();
        var items = CharacterCatalogTestFixture<ItemCatalog>.Create(sheets);
        var skills = CharacterCatalogTestFixture<SkillCatalog>.Create(sheets);
        var itemEntry = await Create(items, "shared ID", QuantityUnit.Whole);
        var skillEntry = await Create(skills, "shared ID", null);
        var itemGroups = await items.Groups.UpdateConfigurationAsync(Admin, 7, Request(0, Input("items", [itemEntry])), default);
        var skillGroups = await skills.Groups.UpdateConfigurationAsync(Admin, 7, Request(0, Input("skills", [skillEntry])), default);
        var itemGroup = Assert.Single(itemGroups.Data.Groups);
        var skillGroup = Assert.Single(skillGroups.Data.Groups);
        Assert.NotEqual(itemGroup.Id, skillGroup.Id);
        Assert.Equal(1, itemGroups.ContentRevision);
        Assert.Equal(1, skillGroups.ContentRevision);
        Assert.Equal("shared ID", Assert.Single((await items.Groups.GetEntriesAsync(Member, 7, itemGroup.Id, default)).Entries).Name);
        Assert.Equal("shared ID", Assert.Single((await skills.Groups.GetEntriesAsync(Member, 7, skillGroup.Id, default)).Entries).Name);
    }

    [Fact]
    public async Task GroupHierarchyIsNavigationOnlyAndMembershipIsSortedUnion()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var a = await Create(f, "same", QuantityUnit.Whole);
        var b = await Create(f, "same", QuantityUnit.Whole);
        var z = await Create(f, "Zulu", QuantityUnit.Whole);
        var tree = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(0, Input("parent", [a]), Input("child", [b])), default);
        var parent = tree.Data.Groups[0];
        var child = tree.Data.Groups[1];
        var configured = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(1,
            Existing(parent, "parent", [a]), Existing(child, "child", [b], parent.Id)), default);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(Admin, 7, Request(2, Existing(parent, "parent", [], child.Id), Existing(child, "child", [], parent.Id)), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(Admin, 7, Request(2, Input("missing parent", [], Guid.NewGuid())), default))).StatusCode);
        var childResult = await f.Groups.GetEntriesAsync(Member, 7, configured.Data.Groups.Single(x => x.Title == "child").Id, default);
        Assert.Equal(b, Assert.Single(childResult.Entries).Id);
        Assert.DoesNotContain(a, childResult.Entries.Select(x => x.Id));

        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture<ItemCatalog>.Definition("flag", "boolean"));
        var attr = Assert.Single(schema.Data.Definitions).Id;
        var source = await Create(f, "filtered", QuantityUnit.Whole, [CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), attr, "true", AttributeEditLevel.Definition)]);
        var union = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(2, Input("union", [z, source], condition: Node("eq", attr, "true"))), default);
        var entries = (await f.Groups.GetEntriesAsync(Member, 7, Assert.Single(union.Data.Groups).Id, default)).Entries;
        Assert.Equal(new[] { "Zulu", "filtered" }, entries.Select(x => x.Name));
        Assert.Equal(2, entries.Length);
    }

    [Fact]
    public async Task ConditionsSupportAndOrNotAndBasicNumericFilters()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture<ItemCatalog>.Definition("rank", "integer"));
        var rank = Assert.Single(schema.Data.Definitions).Id;
        var low = await Create(f, "low", QuantityUnit.Whole, [CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), rank, "2")]);
        var high = await Create(f, "high", QuantityUnit.Whole, [CharacterCatalogTestFixture<ItemCatalog>.Value(Guid.NewGuid(), rank, "5")]);
        var result = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(0, Input("all", [], condition: Node("all", children: [Node("gte", rank, "2"), Node("lt", rank, "4")]))), default);
        Assert.Equal(low, Assert.Single((await f.Groups.GetEntriesAsync(Member, 7, result.Data.Groups[0].Id, default)).Entries).Id);
        result = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(1, Input("any", [], condition: Node("any", children: [Node("eq", rank, "2"), Node("eq", rank, "5")]))), default);
        Assert.Equal(new[] { "high", "low" }, (await f.Groups.GetEntriesAsync(Member, 7, result.Data.Groups[0].Id, default)).Entries.Select(x => x.Name));
        result = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(2, Input("not", [], condition: Node("not", children: [Node("eq", rank, "2")]))), default);
        Assert.Equal(high, Assert.Single((await f.Groups.GetEntriesAsync(Member, 7, result.Data.Groups[0].Id, default)).Entries).Id);
    }

    [Fact]
    public async Task DeletedConditionBindingReturnsNullAndNextPutClearsWholeCondition()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        var schema = await f.DefineSchemaAsync(CharacterCatalogTestFixture<ItemCatalog>.Definition("removed", "integer"), CharacterCatalogTestFixture<ItemCatalog>.Definition("kept", "integer"));
        var removed = schema.Data.Definitions.Single(x => x.Title == "removed").Id;
        var kept = schema.Data.Definitions.Single(x => x.Title == "kept").Id;
        var explicitEntry = await Create(f, "explicit", QuantityUnit.Whole);
        var condition = Node("not", children: [Node("all", children: [Node("exists", removed), Node("eq", kept, "4")])]);
        var groupResponse = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(0, Input("condition", [explicitEntry], condition: condition)), default);
        var group = Assert.Single(groupResponse.Data.Groups);
        await f.Catalog.DeleteAttributeAsync(Admin, 7, removed, schema.ContentRevision, default);
        var writes = f.Sheets.Content.WriteCount;
        var rawResult = await f.Groups.GetConfigurationAsync(Admin, 7, default);
        Assert.Null(Assert.Single(rawResult.Data.Groups).Condition);
        var entryResult = await f.Groups.GetEntriesAsync(Member, 7, group.Id, default);
        Assert.Equal(explicitEntry, Assert.Single(entryResult.Entries).Id);
        Assert.Empty(entryResult.Diagnostics);
        Assert.Equal(writes, f.Sheets.Content.WriteCount);
        var next = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(1, Existing(group, "condition", [explicitEntry], condition: condition)), default);
        Assert.Null(Assert.Single(next.Data.Groups).Condition);
        Assert.Equal(2, next.ContentRevision);
        Assert.Equal(explicitEntry, Assert.Single((await f.Groups.GetEntriesAsync(Member, 7, group.Id, default)).Entries).Id);
    }

    [Fact]
    public async Task GroupVisibilityAndConditionJsonRoundTrip()
    {
        var f = CharacterCatalogTestFixture<ItemCatalog>.Create();
        Assert.Equal(0, (await f.Groups.ListAsync(Member, 7, default)).ContentRevision);
        Assert.Equal(403, (await Error(() => f.Groups.GetConfigurationAsync(Member, 7, default))).StatusCode);
        var hidden = await f.Catalog.CreateAsync(Admin, 7, new CatalogCreateRequest
        {
            RequestId = Guid.NewGuid(), Name = "private", IsHidden = true, QuantityUnit = QuantityUnit.Whole,
            AllowNegative = false, Description = "", Attributes = []
        }, default);
        var group = await f.Groups.UpdateConfigurationAsync(Admin, 7, Request(0, Input("hidden", [hidden.Entry.Id])), default);
        Assert.Empty((await f.Groups.GetEntriesAsync(Member, 7, Assert.Single(group.Data.Groups).Id, default)).Entries);

        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var logical = Node("not", children: [Node("exists", Guid.NewGuid())]);
        var roundTrip = JsonSerializer.Deserialize<CatalogGroupCondition>(JsonSerializer.Serialize(logical, options), options)!;
        Assert.Equal(JsonValueKind.Undefined, Assert.Single(roundTrip.Children!).Value.ValueKind);
    }

    private static Task<Guid> Create<T>(CharacterCatalogTestFixture<T> f, string name, QuantityUnit? unit, CatalogAttributeValue[]? attrs = null) where T : ICatalogType => CreateImpl(f, name, unit, attrs);
    private static async Task<Guid> CreateImpl<T>(CharacterCatalogTestFixture<T> f, string name, QuantityUnit? unit, CatalogAttributeValue[]? attrs) where T : ICatalogType =>
        (await f.Catalog.CreateAsync(Admin, 7, new CatalogCreateRequest { RequestId = Guid.NewGuid(), Name = name, IsHidden = false, QuantityUnit = unit, AllowNegative = false, Description = "", Attributes = attrs ?? [] }, default)).Entry.Id;
    private static CatalogGroupsUpdateRequest Request(long revision, params CatalogGroupInput[] groups) => new() { ExpectedRevision = revision, Groups = groups };
    private static CatalogGroupInput Input(string title, Guid[] entries, Guid? parent = null, CatalogGroupCondition? condition = null) => new() { Title = title, EntryIds = entries, ParentId = parent, Condition = condition };
    private static CatalogGroupInput Existing(CatalogGroup group, string title, Guid[] entries, Guid? parentId = null, CatalogGroupCondition? condition = null) => new() { Id = group.Id, Title = title, EntryIds = entries, ParentId = parentId ?? group.ParentId, Condition = condition };
    private static CatalogGroupCondition Node(string op, Guid? attr = null, string? value = null, CatalogGroupCondition[]? children = null) => new() { Operator = op, AttributeId = attr, Value = value is null ? default : Json(value), Children = children };
    private static JsonElement Json(string json) { using var doc = JsonDocument.Parse(json); return doc.RootElement.Clone(); }
    private static async Task<DomainException> Error(Func<Task> action) => await Assert.ThrowsAsync<DomainException>(action);
}
