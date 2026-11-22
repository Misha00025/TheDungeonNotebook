using System.Text.Json;
using System.Text.Json.Serialization;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public sealed class CatalogGroupServiceTests
{
    private static readonly Subject GlobalAdmin = new(SubjectType.Admin, 9);
    private static readonly Subject CampaignAdmin = new(SubjectType.User, 100);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task EmptyNavigationAndAdministrationAccessAreCampaignScoped()
    {
        var f = CreateFixture();
        var empty = await f.Groups.ListAsync(Member, 7, default);
        Assert.Equal(0, empty.ContentRevision);
        Assert.Empty(empty.Groups);
        Assert.Equal(403, (await Error(() => f.Groups.GetConfigurationAsync(Member, 7, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Groups.UpdateConfigurationAsync(null, 7, Request(0), default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Groups.ListAsync(new Subject(SubjectType.User, 999), 7, default))).StatusCode);
        f.Sheets.Campaigns.SeedCampaign(8);
        Assert.Equal(404, (await Error(() => f.Groups.ListAsync(Member, 8, default))).StatusCode);

        var own = await f.Groups.UpdateConfigurationAsync(CampaignAdmin, 7, Request(0, Input("Owned", [])), default);
        Assert.NotEqual(Guid.Empty, Assert.Single(own.Data.Groups).Id);
        Assert.Equal(403, (await Error(() => f.Groups.UpdateConfigurationAsync(Member, 7, Request(1), default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Groups.GetConfigurationAsync(Member, 7, default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Groups.GetEntriesAsync(Member, 7, Guid.NewGuid(), default))).StatusCode);
    }

    [Fact]
    public async Task GroupIdsAreServerAssignedHierarchyIsValidatedAndParentsDoNotInheritMembers()
    {
        var f = CreateFixture();
        var entry = await AddEntry(f, "One");
        var parent = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Parent", [entry])), default);
        var parentGroup = Assert.Single(parent.Data.Groups);
        Assert.NotEqual(Guid.Empty, parentGroup.Id);
        var child = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(1, Existing(parentGroup, "Parent", [entry]), Input("Child", [], parentGroup.Id)), default);
        var childGroup = child.Data.Groups.Single(x => x.Title == "Child");
        Assert.NotEqual(Guid.Empty, childGroup.Id);
        Assert.Equal(parentGroup.Id, childGroup.ParentId);
        Assert.Equal(entry, Assert.Single((await f.Groups.GetEntriesAsync(Member, 7, parentGroup.Id, default)).Entries).Id);
        Assert.Empty((await f.Groups.GetEntriesAsync(Member, 7, childGroup.Id, default)).Entries);
        var movedMembership = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(2,
            Existing(parentGroup, "Parent", []), Existing(childGroup, "Child", [entry])), default);
        Assert.Empty((await f.Groups.GetEntriesAsync(Member, 7, parentGroup.Id, default)).Entries);
        Assert.Equal(entry, Assert.Single((await f.Groups.GetEntriesAsync(Member, 7, childGroup.Id, default)).Entries).Id);
        Assert.Equal(404, (await Error(() => f.Groups.GetEntriesAsync(Member, 7, Guid.NewGuid(), default))).StatusCode);

        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(3, new CatalogGroupInput { Id = Guid.NewGuid(), Title = "Unknown", EntryIds = [] }), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(3, new CatalogGroupInput { Id = Guid.Empty, Title = "Empty", EntryIds = [] }), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(3,
            Existing(parentGroup, "Duplicate A", []), Existing(parentGroup, "Duplicate B", [])), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(3, Input("Missing", [], Guid.NewGuid())), default))).StatusCode);

        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(3, new CatalogGroupInput { Id = childGroup.Id, Title = "Self", ParentId = childGroup.Id, EntryIds = [] }), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(3,
            new CatalogGroupInput { Id = parentGroup.Id, Title = "A", ParentId = childGroup.Id, EntryIds = [] },
            new CatalogGroupInput { Id = childGroup.Id, Title = "B", ParentId = parentGroup.Id, EntryIds = [] }), default))).StatusCode);
        var omittedChild = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(3, Existing(parentGroup, "Parent", [entry])), default);
        Assert.Single(omittedChild.Data.Groups);
        Assert.Equal(4, omittedChild.ContentRevision);
        Assert.NotNull(await f.CatalogStore.GetAsync(7, entry, default));
    }

    [Fact]
    public async Task ExplicitIdsAreValidatedAndHiddenExplicitEntriesAreVisibleOnlyToPrivilegedReaders()
    {
        var f = CreateFixture();
        var visible = await AddEntry(f, "Visible");
        var hidden = await AddEntry(f, "Hidden", hidden: true);
        foreach (var ids in new[] { new[] { Guid.Empty }, new[] { visible, visible }, new[] { Guid.NewGuid() } })
            Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Invalid", ids)), default))).StatusCode);

        var other = await AddEntry(f, "Foreign", campaignId: 8);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Foreign", [other])), default))).StatusCode);
        var saved = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Hidden", [hidden])), default);
        var id = Assert.Single(saved.Data.Groups).Id;
        Assert.Empty((await f.Groups.GetEntriesAsync(Member, 7, id, default)).Entries);
        Assert.Equal(hidden, Assert.Single((await f.Groups.GetEntriesAsync(CampaignAdmin, 7, id, default)).Entries).Id);

        var nav = await f.Groups.ListAsync(Member, 7, default);
        Assert.DoesNotContain("EntryIds", JsonSerializer.Serialize(nav));
        Assert.DoesNotContain("Condition", JsonSerializer.Serialize(nav));
        Assert.Equal(403, (await Error(() => f.Groups.GetConfigurationAsync(Member, 7, default))).StatusCode);
        Assert.Contains("EntryIds", JsonSerializer.Serialize(await f.Groups.GetConfigurationAsync(GlobalAdmin, 7, default)));
    }

    [Fact]
    public async Task PredicateUnionUsesCatalogueAttributesWithStableOrderingAndExactTypedComparisons()
    {
        var f = CreateFixture();
        var schema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 0,
            Definitions = [Def("weapon", "string"), Def("twohanded", "boolean"), Def("damage", "integer"), Def("rank", "integer"), Def("choice", "singleChoice", [new("a", "A")])]
        }, default);
        var weapon = schema.Data.Definitions.Single(x => x.Title == "weapon").Id;
        var twoHanded = schema.Data.Definitions.Single(x => x.Title == "twohanded").Id;
        var damage = schema.Data.Definitions.Single(x => x.Title == "damage").Id;
        var rank = schema.Data.Definitions.Single(x => x.Title == "rank").Id;
        var choice = schema.Data.Definitions.Single(x => x.Title == "choice").Id;
        var matching = await AddEntry(f, "Same", [Val(weapon, "\"blade\"", "string"), Val(weapon, "\"bow\"", "string"), Val(twoHanded, "true", "boolean"), Val(damage, "9007199254740993"), Val(rank, "4"), Val(choice, "\"a\"", "singleChoice")]);
        var nonmatching = await AddEntry(f, "Same", [Val(weapon, "\"blade\"", "string"), Val(twoHanded, "false", "boolean"), Val(damage, "9007199254740992"), Val(rank, "4"), Val(choice, "\"a\"", "singleChoice")]);
        var explicitOnly = await AddEntry(f, "Zulu");
        var cond = Node("all", null, children:
        [
            Node("eq", weapon, "\"blade\"", "string"), Node("eq", weapon, "\"bow\"", "string"),
            Node("eq", twoHanded, "true", "boolean"), Node("gt", damage, "9007199254740992", "integer"),
            Node("gte", rank, "4", "integer"), Node("lte", rank, "4", "integer"),
            Node("eq", choice, "\"a\"", "singleChoice")
        ]);
        var group = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Arms", [matching, explicitOnly], condition: cond)), default);
        var id = Assert.Single(group.Data.Groups).Id;
        var result = await f.Groups.GetEntriesAsync(Member, 7, id, default);
        Assert.Equal(new[] { matching, explicitOnly }, result.Entries.Select(x => x.Id));
        Assert.DoesNotContain(nonmatching, result.Entries.Select(x => x.Id));
        Assert.Equal(new[] { "Same", "Zulu" }, result.Entries.Select(x => x.Name));
        Assert.Empty(result.Diagnostics);

        var invalid = Node("any", null, children: [Node("not-an-op", weapon, "\"blade\"", "string")]);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(1, Input("Bad", [], condition: invalid)), default))).StatusCode);
    }

    [Fact]
    public async Task StaleSchemaPredicatesAreDiagnosedPreservedAndReadWithoutWrites()
    {
        var f = CreateFixture();
        var schema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest { ExpectedRevision = 0, Definitions = [Def("Count", "integer")] }, default);
        var attr = Assert.Single(schema.Data.Definitions).Id;
        var condition = Node("eq", attr, "1", "integer");
        var entry = await AddEntry(f, "Value", [Val(attr, "1", "integer")]);
        var created = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Numbers", [entry], condition: condition)), default);
        var group = Assert.Single(created.Data.Groups);
        await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 1, Definitions = [new CatalogAttributeDefinitionInput { Id = attr, Title = "Count", TypeKey = "string", Options = [], IsActive = true }]
        }, default);
        var writes = f.Sheets.Content.WriteCount;
        var result = await f.Groups.GetEntriesAsync(Member, 7, group.Id, default);
        Assert.Equal(entry, Assert.Single(result.Entries).Id);
        Assert.Contains(result.Diagnostics, x => x.Code == "incompatible_attribute_type" && x.EntryId is null);
        Assert.Equal(writes, f.Sheets.Content.WriteCount);
        var raw = await f.Groups.GetConfigurationAsync(GlobalAdmin, 7, default);
        Assert.Equal(condition.Value.GetRawText(), raw.Data.Groups.Single().Condition!.Value.GetRawText());
        Assert.Contains(raw.Diagnostics, x => x.Code == "incompatible_attribute_type");
        var renamed = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(1, Existing(group, "Renamed", [entry], condition)), default);
        Assert.Equal("Renamed", Assert.Single(renamed.Data.Groups).Title);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(2, Existing(group, "Changed stale", [entry], Node("eq", attr, "2", "integer"))), default))).StatusCode);
        var currentType = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(2, Existing(group, "Changed current", [entry], Node("eq", attr, "\"1\"", "string", typeRevision: 2))), default);
        Assert.Equal("string", Assert.Single(currentType.Data.Groups).Condition!.TypeKey);
    }

    [Fact]
    public async Task DeactivatedAttributesKeepExistingConditionsButRejectNewReferencesWithoutWrites()
    {
        var f = CreateFixture();
        var schema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 0, Definitions = [Def("Count", "integer")]
        }, default);
        var definition = Assert.Single(schema.Data.Definitions);
        Assert.NotEqual(Guid.Empty, definition.Id);
        var entry = await AddEntry(f, "Counted", [Val(definition.Id, "3")]);
        var existingCondition = Node("eq", definition.Id, "3", "integer");
        var groupEnvelope = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(0, Input("Existing", [entry], condition: existingCondition)), default);
        var group = Assert.Single(groupEnvelope.Data.Groups);

        var deactivated = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 1,
            Definitions = [new CatalogAttributeDefinitionInput { Id = definition.Id, Title = "Count", TypeKey = "integer", Options = [], IsActive = false }]
        }, default);
        Assert.False(Assert.Single(deactivated.Data.Definitions).IsActive);
        var writes = f.Sheets.Content.WriteCount;
        var read = await f.Groups.GetEntriesAsync(Member, 7, group.Id, default);
        Assert.Equal(entry, Assert.Single(read.Entries).Id);
        Assert.Empty(read.Diagnostics);
        Assert.Equal(writes, f.Sheets.Content.WriteCount);

        var titleOnly = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(1, Existing(group, "Renamed", [entry], existingCondition)), default);
        Assert.Equal("Renamed", Assert.Single(titleOnly.Data.Groups).Title);
        var changedExistingReference = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(2, Existing(group, "Edited", [entry], Node("eq", definition.Id, "4", "integer"))), default);
        Assert.Equal("4", Assert.Single(changedExistingReference.Data.Groups).Condition!.Value.GetRawText());

        var writesBeforeInvalid = f.Sheets.Content.WriteCount;
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(3, Input("New reference", [], condition: Node("eq", definition.Id, "3", "integer"))), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(3, Input("New exists reference", [], condition: Node("exists", definition.Id))), default))).StatusCode);
        Assert.Equal(writesBeforeInvalid, f.Sheets.Content.WriteCount);
    }

    [Fact]
    public async Task MalformedPredicateShapesAreRejectedAtCurrentConfigurationRevision()
    {
        var f = CreateFixture();
        var schema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 0, Definitions = [Def("Count", "integer"), Def("Label", "string")]
        }, default);
        var count = schema.Data.Definitions.Single(x => x.Title == "Count").Id;
        var label = schema.Data.Definitions.Single(x => x.Title == "Label").Id;
        await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Existing", [])), default);
        var malformed = new[]
        {
            Node("all", null, children: []),
            Node("any", null, children: []),
            Node("not", null, children: [Node("exists", count), Node("exists", count)]),
            Node("all", count, children: [Node("exists", count)]),
            Node("gt", label, "2", "string"),
            Node("eq", Guid.NewGuid(), "1", "integer")
        };
        foreach (var condition in malformed)
        {
            var error = await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
                Request(1, Input("Invalid", [], condition: condition)), default));
            Assert.Equal(400, error.StatusCode);
            Assert.Equal("invalid_group_condition", error.Code);
        }
    }

    [Fact]
    public async Task AnyExistsAndLessThanEvaluateCatalogueValuesAtNumericBoundaries()
    {
        var f = CreateFixture();
        var schema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 0, Definitions = [Def("Count", "integer"), Def("Tag", "string")]
        }, default);
        var count = schema.Data.Definitions.Single(x => x.Title == "Count").Id;
        var tag = schema.Data.Definitions.Single(x => x.Title == "Tag").Id;
        var lower = await AddEntry(f, "Lower", [Val(count, "-9223372036854775808"), Val(tag, "\"x\"", "string")]);
        var boundary = await AddEntry(f, "Boundary", [Val(count, "9007199254740993")]);
        var upper = await AddEntry(f, "Upper", [Val(count, "9223372036854775807")]);
        var explicitMember = await AddEntry(f, "Explicit");
        var any = Node("any", null, children:
        [
            Node("eq", tag, "\"missing\"", "string"), Node("eq", count, "9007199254740993", "integer")
        ]);
        var group = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(0, Input("Any", [boundary], condition: any)), default);
        var firstId = Assert.Single(group.Data.Groups).Id;
        var anyResult = await f.Groups.GetEntriesAsync(Member, 7, firstId, default);
        Assert.Equal(new[] { boundary }, anyResult.Entries.Select(x => x.Id));

        group = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(1,
            Input("Exists", [], condition: Node("exists", tag))), default);
        var existsResult = await f.Groups.GetEntriesAsync(Member, 7, Assert.Single(group.Data.Groups).Id, default);
        Assert.Equal(lower, Assert.Single(existsResult.Entries).Id);

        group = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(2,
            Input("Less", [explicitMember], condition: Node("lt", count, "9007199254740993", "integer"))), default);
        var lessResult = await f.Groups.GetEntriesAsync(Member, 7, Assert.Single(group.Data.Groups).Id, default);
        Assert.Contains(lower, lessResult.Entries.Select(x => x.Id));
        Assert.Contains(explicitMember, lessResult.Entries.Select(x => x.Id));
        Assert.DoesNotContain(boundary, lessResult.Entries.Select(x => x.Id));
        Assert.DoesNotContain(upper, lessResult.Entries.Select(x => x.Id));
    }

    [Fact]
    public async Task HiddenCandidatesAreFilteredBeforeContentReadsWhilePublishedVisibleMissingContentFails()
    {
        var f = CreateFixture();
        var schema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest { ExpectedRevision = 0, Definitions = [Def("Count", "integer")] }, default);
        var attr = Assert.Single(schema.Data.Definitions).Id;
        var hiddenId = Guid.NewGuid();
        f.CatalogStore.Entries.Add(new CatalogEntry { Id = hiddenId, CampaignId = 7, Name = "private marker", Kind = CatalogKind.Item, IsHidden = true });
        var condition = Node("exists", attr);
        var group = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Filtered", [hiddenId], condition: condition)), default);
        var groupId = Assert.Single(group.Data.Groups).Id;
        var reads = f.Sheets.Content.ReadCount;
        var member = await f.Groups.GetEntriesAsync(Member, 7, groupId, default);
        Assert.Empty(member.Entries);
        Assert.DoesNotContain(hiddenId, member.Diagnostics.Select(x => x.EntryId));
        Assert.DoesNotContain("private marker", JsonSerializer.Serialize(member));
        Assert.Equal(reads + 2, f.Sheets.Content.ReadCount);

        var visibleId = Guid.NewGuid();
        f.CatalogStore.Entries.Add(new CatalogEntry { Id = visibleId, CampaignId = 7, Name = "published marker", Kind = CatalogKind.Item, IsHidden = false });
        var visibleGroup = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7,
            Request(1, Input("Missing content", [visibleId])), default);
        var visibleGroupId = visibleGroup.Data.Groups.Single().Id;
        var unavailable = await Error(() => f.Groups.GetEntriesAsync(Member, 7, visibleGroupId, default));
        Assert.Equal(503, unavailable.StatusCode);
        Assert.Equal("content_unavailable", unavailable.Code);
    }

    [Fact]
    public async Task NotAndRepeatedOccurrencesAreConservativeAndDiagnosticsDoNotExposePrivateIds()
    {
        var f = CreateFixture();
        var schema = await f.Catalog.UpdateAttributesAsync(GlobalAdmin, 7, new CatalogAttributesUpdateRequest
        {
            ExpectedRevision = 0, Definitions = [Def("Count", "integer"), Def("Label", "string")]
        }, default);
        var count = schema.Data.Definitions.Single(x => x.Title == "Count").Id;
        var incompatible = await AddEntry(f, "incompatible");
        var absent = await AddEntry(f, "absent");
        var malformed = await AddEntry(f, "malformed");
        await f.Content.ReplaceAsync("catalogContents", 7, incompatible, 1,
            new CatalogContent("", [Val(count, "\"wrong type\"", "string")]), default);
        await f.Content.ReplaceAsync("catalogContents", 7, malformed, 1,
            new CatalogContent("", [Val(count, "1"), Val(count, "\"bad\"")]), default);
        var explicitEntry = await AddEntry(f, "explicit");
        var condition = Node("not", null, children: [Node("eq", count, "1", "integer")]);
        var group = await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(0, Input("Negated", [explicitEntry], condition: condition)), default);
        var id = Assert.Single(group.Data.Groups).Id;
        var result = await f.Groups.GetEntriesAsync(Member, 7, id, default);
        Assert.Contains(absent, result.Entries.Select(x => x.Id));
        Assert.Contains(explicitEntry, result.Entries.Select(x => x.Id));
        Assert.DoesNotContain(incompatible, result.Entries.Select(x => x.Id));
        Assert.DoesNotContain(malformed, result.Entries.Select(x => x.Id));
        Assert.Contains(result.Diagnostics, x => x.EntryId == incompatible && x.Code == "incompatible_attribute_type");
        Assert.Contains(result.Diagnostics, x => x.EntryId == malformed && x.Code == "invalid_attribute_value");
        Assert.DoesNotContain(Guid.Empty, result.Diagnostics.Select(x => x.GroupId));
        Assert.DoesNotContain(Guid.Empty, result.Diagnostics.Where(x => x.EntryId.HasValue).Select(x => x.EntryId!.Value));
    }

    [Fact]
    public async Task GroupsCasRacesReturnConflictWithoutRetryAndJsonRoundTripsConditionsStrictly()
    {
        var f = CreateFixture();
        var request = Request(0, Input("First", []));
        await f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, request, default);
        Assert.Equal(409, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, request, default))).StatusCode);
        Assert.Equal(1, f.Sheets.Content.CreateCount);
        Assert.Equal(0, f.Sheets.Content.ReplaceCount);
        var createRace = CreateFixture();
        createRace.Content.CreateFailure = new ContentAlreadyPreparedException();
        Assert.Equal(409, (await Error(() => createRace.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, request, default))).StatusCode);
        Assert.Equal(1, createRace.Content.CreateCount);
        Assert.Equal(0, createRace.Content.ReplaceCount);
        f.Content.ReplaceReturnsNull = true;
        Assert.Equal(409, (await Error(() => f.Groups.UpdateConfigurationAsync(GlobalAdmin, 7, Request(1, Input("Race", [])), default))).StatusCode);
        Assert.Equal(1, f.Content.ReplaceCount);

        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        var nested = Node("all", null, children: [Node("any", null, children:
        [
            Node("not", null, children: [Node("exists", Guid.NewGuid())]),
            Node("eq", Guid.NewGuid(), "false", "boolean")
        ])]);
        var json = JsonSerializer.Serialize(nested, options);
        var roundTrip = Assert.IsType<CatalogGroupCondition>(JsonSerializer.Deserialize<CatalogGroupCondition>(json, options));
        Assert.Equal("all", roundTrip.Operator);
        var allChildren = Assert.IsType<CatalogGroupCondition[]>(roundTrip.Children);
        var any = Assert.Single(allChildren);
        Assert.Equal("any", any.Operator);
        var anyChildren = Assert.IsType<CatalogGroupCondition[]>(any.Children);
        var negation = anyChildren[0];
        Assert.Equal("not", negation.Operator);
        var notChildren = Assert.IsType<CatalogGroupCondition[]>(negation.Children);
        var exists = Assert.Single(notChildren);
        Assert.Equal(JsonValueKind.Undefined, exists.Value.ValueKind);
        Assert.Equal(JsonValueKind.False, anyChildren[1].Value.ValueKind);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CatalogGroupsUpdateRequest>("{\"expectedRevision\":0,\"groups\":[],\"unexpected\":true}", options));
    }

    private static Fixture CreateFixture()
    {
        var sheets = SheetServiceTests.CreateFixture();
        var store = new FakeCatalogStore();
        var characterStore = new FakeCharacterCatalogStore(store, (_, _) => true);
        var content = new GroupContentStore(sheets.Content);
        var campaign = new Tdn.Campaigns.Campaigns.CampaignService(sheets.Campaigns);
        var catalog = new CatalogService(campaign, store, content, characterStore);
        return new Fixture(sheets, store, content, catalog, new CatalogGroupService(campaign, catalog, store, content));
    }

    private static CatalogGroupsUpdateRequest Request(long revision, params CatalogGroupInput[] groups) => new() { ExpectedRevision = revision, Groups = groups };
    private static CatalogGroupInput Input(string title, Guid[] entries, Guid? parent = null, CatalogGroupCondition? condition = null) => new() { Title = title, ParentId = parent, EntryIds = entries, Condition = condition };
    private static CatalogGroupInput Existing(CatalogGroup group, string title, Guid[] entries, CatalogGroupCondition? condition = null) => new() { Id = group.Id, Title = title, ParentId = group.ParentId, EntryIds = entries, Condition = condition };
    private static CatalogAttributeDefinitionInput Def(string title, string type, ChoiceOption[]? options = null) => new() { Title = title, TypeKey = type, Options = options ?? [], IsActive = true };
    private static CatalogGroupCondition Node(string op, Guid? attr, string? value = null, string? type = null, CatalogGroupCondition[]? children = null, long? typeRevision = 1) => new()
    {
        Operator = op, AttributeId = attr, TypeKey = type, TypeRevision = type is null ? null : typeRevision,
        Value = value is null ? default : CharacterCatalogTestFixture.Json(value), Children = children
    };
    private static CatalogAttributeValue Val(Guid attr, string json, string type = "integer") => CharacterCatalogTestFixture.Value(Guid.NewGuid(), attr, type, 1, json);
    private static async Task<Guid> AddEntry(Fixture f, string name, CatalogAttributeValue[]? attrs = null, bool hidden = false, int campaignId = 7)
    {
        if (campaignId != 7) f.Sheets.Campaigns.SeedCampaign(campaignId);
        var result = await f.Catalog.CreateAsync(GlobalAdmin, campaignId, new CatalogCreateRequest
        {
            RequestId = Guid.NewGuid(), Name = name, Kind = CatalogKind.Item, IsHidden = hidden, QuantityUnit = QuantityUnit.Whole,
            AllowNegative = false, Description = "", Attributes = attrs ?? []
        }, default);
        return result.Entry.Id;
    }
    private static async Task<DomainException> Error(Func<Task> action) => await Assert.ThrowsAsync<DomainException>(action);
    private sealed record Fixture(SheetServiceTests.Fixture Sheets, FakeCatalogStore CatalogStore, GroupContentStore Content, CatalogService Catalog, CatalogGroupService Groups);

    private sealed class GroupContentStore(IContentStore inner) : IContentStore
    {
        public bool ReplaceReturnsNull { get; set; }
        public Exception? CreateFailure { get; set; }
        public int CreateCount { get; private set; }
        public int ReplaceCount { get; private set; }
        public Task<ContentEnvelope<T>?> GetAsync<T>(string collection, int campaignId, Guid resourceId, CancellationToken cancellationToken) => inner.GetAsync<T>(collection, campaignId, resourceId, cancellationToken);
        public Task<ContentEnvelope<T>> CreateAsync<T>(string collection, int campaignId, Guid resourceId, T data, CancellationToken cancellationToken)
        {
            CreateCount++;
            return CreateFailure is null ? inner.CreateAsync(collection, campaignId, resourceId, data, cancellationToken) : Task.FromException<ContentEnvelope<T>>(CreateFailure);
        }
        public Task<ContentEnvelope<T>?> ReplaceAsync<T>(string collection, int campaignId, Guid resourceId, long expectedRevision, T data, CancellationToken cancellationToken)
        {
            ReplaceCount++;
            return ReplaceReturnsNull ? Task.FromResult<ContentEnvelope<T>?>(null) : inner.ReplaceAsync(collection, campaignId, resourceId, expectedRevision, data, cancellationToken);
        }
    }
}
