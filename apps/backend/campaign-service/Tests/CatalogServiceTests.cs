using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public sealed class CatalogServiceTests
{
    private static readonly Subject GlobalAdmin = new(SubjectType.Admin, 9);
    private static readonly Subject CampaignAdmin = new(SubjectType.User, 100);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task SchemaStartsAtRevisionZeroAndRequiresCampaignAdministrationToWrite()
    {
        var f = CreateFixture();
        var empty = await f.Service.GetAttributesAsync(Member, 7, default);
        Assert.Equal(0, empty.ContentRevision);
        Assert.Empty(empty.Data.Definitions);

        Assert.Equal(403, (await Error(() => f.Service.UpdateAttributesAsync(Member, 7, SchemaRequest(0), default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.UpdateAttributesAsync(null, 7, SchemaRequest(0), default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.GetAttributesAsync(new Subject(SubjectType.User, 999), 7, default))).StatusCode);
        f.Campaigns.SeedCampaign(8);
        Assert.Equal(404, (await Error(() => f.Service.GetAttributesAsync(new Subject(SubjectType.Group, 8), 7, default))).StatusCode);
        Assert.Equal(0, (await f.Service.GetAttributesAsync(new Subject(SubjectType.Group, 8), 8, default)).ContentRevision);
    }

    [Fact]
    public async Task SchemaUsesServerIdentitiesAndRetainsRevisionHistoryAcrossCompatibleAndBreakingChanges()
    {
        var f = CreateFixture();
        var created = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(0, Def(null, "Rarity", "singleChoice", [new("common", "Common"), new("rare", "Rare")])), default);
        Assert.Equal(1, created.ContentRevision);
        var definition = Assert.Single(created.Data.Definitions);
        Assert.NotEqual(Guid.Empty, definition.Id);
        Assert.Equal(1, definition.TypeRevision);

        var compatible = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(1, Def(definition.Id, "Rarity renamed", "singleChoice", [new("rare", "Rare label"), new("common", "Common"), new("legendary", "Legendary")])), default);
        Assert.Equal(1, Assert.Single(compatible.Data.Definitions).TypeRevision);

        var removedOption = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(2, Def(definition.Id, "Rarity renamed", "singleChoice", [new("common", "Common")])), default);
        Assert.Equal(2, Assert.Single(removedOption.Data.Definitions).TypeRevision);
        var changedType = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(3, Def(definition.Id, "Rarity renamed", "string", [])), default);
        Assert.Equal(3, Assert.Single(changedType.Data.Definitions).TypeRevision);
        var returnedType = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(4, Def(definition.Id, "Rarity renamed", "singleChoice", [new("common", "Common")])), default);
        Assert.Equal(4, Assert.Single(returnedType.Data.Definitions).TypeRevision);

        var unknown = await Error(() => f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(5, Def(Guid.NewGuid(), "Unknown", "string", [])), default));
        Assert.Equal(400, unknown.StatusCode);
        var duplicate = await Error(() => f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(5, Def(definition.Id, "One", "string", []), Def(definition.Id, "Two", "string", [])), default));
        Assert.Equal(400, duplicate.StatusCode);
    }

    [Fact]
    public async Task OmittedSchemaDefinitionsAreRetainedAsInactive()
    {
        var f = CreateFixture();
        var initial = await Define(f, Def(null, "Retire me", "string", []));
        var generatedId = Assert.Single(initial.Data.Definitions).Id;
        var omitted = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(1), default);
        var retained = Assert.Single(omitted.Data.Definitions);
        Assert.Equal(generatedId, retained.Id);
        Assert.False(retained.IsActive);
        Assert.Equal(2, omitted.ContentRevision);
    }

    [Fact]
    public async Task SchemaCasCreateRaceAndReplaceRaceReturnConflictsWithoutRetry()
    {
        var f = CreateFixture();
        var first = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0, Def(null, "Name", "string", [])), default);
        Assert.Equal(1, first.ContentRevision);
        var stale = await Error(() => f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0), default));
        Assert.Equal(409, stale.StatusCode);

        var empty = CreateFixture();
        empty.Content.CreateFailure = new ContentAlreadyPreparedException();
        var creationRace = await Error(() => empty.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0), default));
        Assert.Equal("content_revision_conflict", creationRace.Code);
        Assert.Equal(1, empty.Content.CreateCount);
        Assert.Equal(0, empty.Content.ReplaceCount);

        f.Content.ReplaceReturnsNull = true;
        var replaceRace = await Error(() => f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(1), default));
        Assert.Equal(409, replaceRace.StatusCode);
        Assert.Equal(1, f.Content.ReplaceCount);
    }

    [Fact]
    public async Task ContentPreservesNativeValuesAndRepeatedAttributeOccurrences()
    {
        var f = CreateFixture();
        var schema = await Define(f, Def(null, "text", "string", []), Def(null, "integer", "integer", []),
            Def(null, "number", "number", []), Def(null, "bool", "boolean", []),
            Def(null, "choice", "singleChoice", [new("a", "A")]), Def(null, "multi", "multiChoice", [new("a", "A"), new("b", "B")]));
        var textId = schema.Data.Definitions.Single(x => x.Title == "text").Id;
        var integerId = schema.Data.Definitions.Single(x => x.Title == "integer").Id;
        var numberId = schema.Data.Definitions.Single(x => x.Title == "number").Id;
        var boolId = schema.Data.Definitions.Single(x => x.Title == "bool").Id;
        var choiceId = schema.Data.Definitions.Single(x => x.Title == "choice").Id;
        var multiId = schema.Data.Definitions.Single(x => x.Title == "multi").Id;
        var occurrences = new[]
        {
            Value(Guid.NewGuid(), textId, "string", 1, "\"\"", AttributeEditLevel.Definition),
            Value(Guid.NewGuid(), textId, "string", 1, "\"text\"", AttributeEditLevel.Character),
            Value(Guid.NewGuid(), integerId, "integer", 1, "9007199254740993"),
            Value(Guid.NewGuid(), integerId, "integer", 1, "0"),
            Value(Guid.NewGuid(), integerId, "integer", 1, "-7"),
            Value(Guid.NewGuid(), numberId, "number", 1, "-1.25"),
            Value(Guid.NewGuid(), boolId, "boolean", 1, "false"),
            Value(Guid.NewGuid(), choiceId, "singleChoice", 1, "\"a\""),
            Value(Guid.NewGuid(), multiId, "multiChoice", 1, "[]"),
            Value(Guid.NewGuid(), multiId, "multiChoice", 1, "[\"b\",\"a\"]")
        };
        var result = await f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false, occurrences), default);
        var stored = result.Content.Data.Attributes;
        Assert.Equal("9007199254740993", stored.Single(x => x.AttributeId == integerId && x.Value.GetRawText() == "9007199254740993").Value.GetRawText());
        Assert.Equal("-7", stored.Single(x => x.Value.GetRawText() == "-7").Value.GetRawText());
        Assert.Equal("-1.25", stored.Single(x => x.AttributeId == numberId).Value.GetRawText());
        Assert.Equal("false", stored.Single(x => x.AttributeId == boolId).Value.GetRawText());
        Assert.Equal("\"\"", stored.First(x => x.AttributeId == textId).Value.GetRawText());
        Assert.Equal(0, stored.Single(x => x.AttributeId == multiId && x.Value.GetArrayLength() == 0).Value.GetArrayLength());
        Assert.Equal("[\"b\",\"a\"]", stored.Single(x => x.AttributeId == multiId && x.Value.GetArrayLength() == 2).Value.GetRawText());
        Assert.Equal(2, stored.Count(x => x.AttributeId == textId));
        Assert.Contains(stored, x => x.EditLevel == AttributeEditLevel.Character);
    }

    [Fact]
    public async Task SchemaAndOccurrenceValidationRejectInvalidDefinitionsAndValuesBeforeWrites()
    {
        var f = CreateFixture();
        var invalidType = await Error(() => f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0, Def(null, "Unknown", "decimal", [])), default));
        Assert.Equal(400, invalidType.StatusCode);
        var invalidOptions = await Error(() => f.Service.UpdateAttributesAsync(GlobalAdmin, 7,
            SchemaRequest(0, Def(null, "Choice", "singleChoice", [new("same", "one"), new("same", "two")])), default));
        Assert.Equal(400, invalidOptions.StatusCode);
        Assert.Equal(0, f.Content.WriteCount);

        var initialSchema = await Define(f, Def(null, "Count", "integer", []), Def(null, "Choice", "singleChoice", [new("x", "X")]));
        var count = initialSchema.Data.Definitions.Single(x => x.Title == "Count");
        var choice = initialSchema.Data.Definitions.Single(x => x.Title == "Choice");
        var expandedSchema = await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(1,
            Def(count.Id, "Count", "integer", []), Def(choice.Id, "Choice", "singleChoice", [new("x", "X")]), Def(null, "Multi", "multiChoice", [new("x", "X")])), default);
        var multiId = expandedSchema.Data.Definitions.Single(x => x.Title == "Multi").Id;
        foreach (var invalid in new[]
        {
            Value(Guid.NewGuid(), count.Id, "integer", 1, "1.1"),
            Value(Guid.NewGuid(), count.Id, "number", 1, "1"),
            Value(Guid.NewGuid(), count.Id, "integer", 0, "1"),
            Value(Guid.NewGuid(), count.Id, "integer", 1, "\"1\""),
            Value(Guid.NewGuid(), count.Id, "integer", 1, "1", (AttributeEditLevel)5),
            Value(Guid.NewGuid(), multiId, "multiChoice", 1, "[\"x\",\"x\"]"),
            new CatalogAttributeValue(Guid.NewGuid(), count.Id, "integer", 1, default, AttributeEditLevel.Definition),
            Value(Guid.NewGuid(), count.Id, " ", 1, "1"),
            Value(Guid.NewGuid(), Guid.NewGuid(), "string", 1, "\"x\""),
            Value(Guid.Empty, count.Id, "integer", 1, "1"),
            Value(Guid.NewGuid(), choice.Id, "singleChoice", 1, "\"absent\"")
        })
        {
            var bad = await Error(() => f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false, [invalid]), default));
            Assert.Equal(400, bad.StatusCode);
        }
        var duplicateId = Guid.NewGuid();
        var duplicate = await Error(() => f.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false,
                [Value(duplicateId, count.Id, "integer", 1, "1"), Value(duplicateId, count.Id, "integer", 1, "2")]), default));
        Assert.Equal(400, duplicate.StatusCode);
        Assert.Equal(0, f.Store.CreateCount);
    }

    [Fact]
    public async Task CreateValidatesMetadataBeforeMongoAndPublishesInOrderWithDerivedCreator()
    {
        var f = CreateFixture();
        var noneHidden = CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false, [], includeHidden: false);
        Assert.Equal("invalid_metadata", (await Error(() => f.Service.CreateAsync(GlobalAdmin, 7, noneHidden, default))).Code);
        Assert.Equal(0, f.Content.WriteCount);
        Assert.Equal(400, (await Error(() => f.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, null, false, []), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, (QuantityUnit)7, false, []), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(Guid.NewGuid(), CatalogKind.Skill, false, null, true, []), default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(Guid.NewGuid(), (CatalogKind)9, false, QuantityUnit.Whole, false, []), default))).StatusCode);
        Assert.Equal(0, f.Content.WriteCount);

        f.Store.BeforeCreate = entry => Assert.NotNull(f.Content.GetData<CatalogContent>("catalogContents", 7, entry.Id));
        var authored = await f.Service.CreateAsync(CampaignAdmin, 7, CreateRequest(Guid.NewGuid(), CatalogKind.Item, true, QuantityUnit.Single, false, []), default);
        Assert.Equal<int?>(100, authored.Entry.CreatorUserId);
        Assert.True(authored.Entry.IsHidden);
        Assert.Equal(1, authored.Content.ContentRevision);

        var skill = await f.Service.CreateAsync(new Subject(SubjectType.Group, 7), 7,
            CreateRequest(Guid.NewGuid(), CatalogKind.Skill, false, null, false, []), default);
        Assert.Null(skill.Entry.CreatorUserId);
        var adminEntry = await f.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(Guid.NewGuid(), CatalogKind.Skill, false, null, false, []), default);
        Assert.Null(adminEntry.Entry.CreatorUserId);
    }

    [Fact]
    public async Task PublicationDuplicatesUnknownSqlOutcomeAndCancellationKeepExpectedBoundaries()
    {
        var f = CreateFixture();
        var requestId = Guid.NewGuid();
        var request = CreateRequest(requestId, CatalogKind.Item, false, QuantityUnit.Whole, false, []);
        f.Store.CreateFailure = new DbUpdateException("unknown");
        var unknown = await Error(() => f.Service.CreateAsync(GlobalAdmin, 7, request, default));
        Assert.Equal(503, unknown.StatusCode);
        Assert.Equal("publication_outcome_unknown", unknown.Code);
        Assert.Equal(requestId, Assert.IsType<Guid>(unknown.ResourceId));
        Assert.Equal<Guid?>(requestId, unknown.RequestId);
        Assert.NotNull(f.Content.GetData<CatalogContent>("catalogContents", 7, requestId));
        Assert.Empty(await f.Service.ListAsync(GlobalAdmin, 7, null, default));
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(GlobalAdmin, 7, requestId, default))).StatusCode);

        var retry = await Error(() => f.Service.CreateAsync(GlobalAdmin, 7, request, default));
        Assert.Equal("content_already_prepared", retry.Code);
        Assert.Equal(1, f.Store.CreateCount);

        var cancelled = CreateFixture();
        cancelled.Store.CreateFailure = new OperationCanceledException();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cancelled.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false, []), default));

        var prepared = CreateFixture();
        var preparedId = Guid.NewGuid();
        await prepared.Content.CreateAsync("catalogContents", 7, preparedId, new CatalogContent("preserved", []), default);
        var duplicatePrepared = await Error(() => prepared.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(preparedId, CatalogKind.Item, false, QuantityUnit.Whole, false, []), default));
        Assert.Equal(409, duplicatePrepared.StatusCode);
        Assert.Equal(preparedId, Assert.IsType<Guid>(duplicatePrepared.ResourceId));
        Assert.Equal<Guid?>(preparedId, duplicatePrepared.RequestId);
        Assert.Equal(0, prepared.Store.CreateCount);
        Assert.Equal("preserved", prepared.Content.GetData<CatalogContent>("catalogContents", 7, preparedId).Description);

        var alreadyPublished = CreateFixture();
        var publishedId = Guid.NewGuid();
        alreadyPublished.Store.Entries.Add(Entry(publishedId));
        var before = alreadyPublished.Content.WriteCount;
        Assert.Equal(409, (await Error(() => alreadyPublished.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(publishedId, CatalogKind.Item, false, QuantityUnit.Whole, false, []), default))).StatusCode);
        Assert.Equal(before, alreadyPublished.Content.WriteCount);

        var duplicateRace = CreateFixture();
        duplicateRace.Store.CreateFailure = new DuplicateResourceException();
        var raceId = Guid.NewGuid();
        var sqlDuplicate = await Error(() => duplicateRace.Service.CreateAsync(GlobalAdmin, 7,
            CreateRequest(raceId, CatalogKind.Item, false, QuantityUnit.Whole, false, []), default));
        Assert.Equal(409, sqlDuplicate.StatusCode);
        Assert.Equal(raceId, Assert.IsType<Guid>(sqlDuplicate.ResourceId));
        Assert.NotNull(duplicateRace.Content.GetData<CatalogContent>("catalogContents", 7, raceId));
    }

    [Fact]
    public async Task VisibilityOwnershipAndHiddenStateFollowCampaignAndCreatorRights()
    {
        var f = CreateFixture();
        var id = Guid.NewGuid();
        var created = await f.Service.CreateAsync(CampaignAdmin, 7, CreateRequest(id, CatalogKind.Item, true, QuantityUnit.Whole, false, []), default);
        var publicId = Guid.NewGuid();
        await f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(publicId, CatalogKind.Item, false, QuantityUnit.Whole, false, []), default);
        f.Campaigns.Members.Single(x => x.UserId == 100).IsAdmin = false;

        Assert.Single(await f.Service.ListAsync(Member, 7, null, default));
        Assert.Equal(publicId, (await f.Service.ListAsync(Member, 7, null, default)).Single().Id);
        Assert.Empty(await f.Service.ListAsync(Member, 7, CatalogKind.Skill, default));
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(Member, 7, id, default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.GetContentAsync(Member, 7, id, default))).StatusCode);
        Assert.Equal(id, (await f.Service.GetAsync(CampaignAdmin, 7, id, default)).Id);
        var authorContent = await f.Service.UpdateContentAsync(CampaignAdmin, 7, id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "author edit", Attributes = [] }, default);
        Assert.Equal("author edit", authorContent.Data.Description);

        var authorUpdate = await f.Service.UpdateMetadataAsync(CampaignAdmin, 7, id,
            new CatalogMetadataUpdateRequest { Name = "Owned rename", IsHidden = true, ExpectedRevision = 1 }, default);
        Assert.Equal(2, authorUpdate.MetadataRevision);
        Assert.Equal(403, (await Error(() => f.Service.UpdateMetadataAsync(CampaignAdmin, 7, id,
            new CatalogMetadataUpdateRequest { Name = "Unhide", IsHidden = false, ExpectedRevision = 2 }, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.UpdateMetadataAsync(Member, 7, publicId,
            new CatalogMetadataUpdateRequest { Name = "Other public edit", ExpectedRevision = 1 }, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.UpdateContentAsync(Member, 7, publicId,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "Other public edit", Attributes = [] }, default))).StatusCode);

        var publicEntry = await f.Service.UpdateMetadataAsync(GlobalAdmin, 7, id,
            new CatalogMetadataUpdateRequest { Name = "Public", IsHidden = false, ExpectedRevision = 2 }, default);
        Assert.False(publicEntry.IsHidden);
        Assert.Equal(2, (await f.Service.ListAsync(Member, 7, null, default)).Count);
        Assert.Equal(400, (await Error(() => f.Service.ListAsync(Member, 7, (CatalogKind)5, default))).StatusCode);
        Assert.Equal(403, (await Error(() => f.Service.ListAsync(null, 7, null, default))).StatusCode);
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(new Subject(SubjectType.Group, 8), 7, id, default))).StatusCode);

        f.Campaigns.SeedCampaign(8);
        Assert.Equal(404, (await Error(() => f.Service.GetAsync(GlobalAdmin, 8, created.Entry.Id, default))).StatusCode);
    }

    [Fact]
    public async Task ContentReadsDiagnoseWithoutWritesAndDescriptionOnlyUpdateRetainsStaleValues()
    {
        var f = CreateFixture();
        var schema = await Define(f, Def(null, "Count", "integer", []));
        var attributeId = Assert.Single(schema.Data.Definitions).Id;
        var initial = Value(Guid.NewGuid(), attributeId, "integer", 1, "9007199254740993");
        var created = await f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false, [initial]), default);
        var occurrence = created.Content.Data.Attributes.Single();
        var definition = schema.Data.Definitions.Single();
        await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(1, Def(definition.Id, "Count", "string", [])), default);
        var writes = f.Content.WriteCount;
        var read = await f.Service.GetContentAsync(Member, 7, created.Entry.Id, default);
        Assert.Equal(occurrence.Value.GetRawText(), read.Data.Attributes.Single().Value.GetRawText());
        Assert.Equal("incompatible_attribute_type", Assert.Single(read.Diagnostics).Code);
        Assert.Equal(writes, f.Content.WriteCount);

        var description = await f.Service.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "only description", Attributes = [occurrence] }, default);
        Assert.Equal(2, description.ContentRevision);
        Assert.Equal(occurrence.Value.GetRawText(), description.Data.Attributes.Single().Value.GetRawText());
        var writesAfterDescription = f.Content.WriteCount;
        var changedStale = occurrence with { Value = Json("2") };
        Assert.Equal(400, (await Error(() => f.Service.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 2, Description = "blocked", Attributes = [changedStale] }, default))).StatusCode);
        Assert.Equal(writesAfterDescription, f.Content.WriteCount);
        Assert.Equal("only description", f.Content.GetData<CatalogContent>("catalogContents", 7, created.Entry.Id).Description);
    }

    [Fact]
    public async Task RetiredValuesCanRemainOrChangeUnderTheirExistingBindingButCannotBeRebound()
    {
        var f = CreateFixture();
        var initialSchema = await Define(f, Def(null, "Retired", "integer", []), Def(null, "Other", "integer", []));
        var retiredId = initialSchema.Data.Definitions.Single(x => x.Title == "Retired").Id;
        var otherId = initialSchema.Data.Definitions.Single(x => x.Title == "Other").Id;
        var occurrenceId = Guid.NewGuid();
        var otherOccurrenceId = Guid.NewGuid();
        var oldValue = Value(occurrenceId, retiredId, "integer", 1, "1");
        var oldOtherValue = Value(otherOccurrenceId, otherId, "integer", 1, "4");
        var created = await f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false, [oldValue, oldOtherValue]), default);
        await f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(1,
            Def(retiredId, "Retired", "integer", [], false), Def(otherId, "Other", "integer", [], false)), default);

        var same = await f.Service.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "same", Attributes = [oldValue, oldOtherValue] }, default);
        Assert.Empty(same.Diagnostics);
        var changedValue = oldValue with { Value = Json("2") };
        var changed = await f.Service.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 2, Description = "edited", Attributes = [changedValue, oldOtherValue] }, default);
        Assert.Equal("2", changed.Data.Attributes.Single(x => x.Id == occurrenceId).Value.GetRawText());

        var reboundToInactive = oldOtherValue with { AttributeId = retiredId, Value = Json("3") };
        var added = Value(Guid.NewGuid(), retiredId, "integer", 1, "3");
        Assert.Equal(400, (await Error(() => f.Service.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 3, Description = "bad", Attributes = [changedValue, reboundToInactive] }, default))).StatusCode);
        Assert.Equal(400, (await Error(() => f.Service.UpdateContentAsync(GlobalAdmin, 7, created.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 3, Description = "bad", Attributes = [changedValue, oldOtherValue, added] }, default))).StatusCode);
    }

    [Fact]
    public async Task ContentAndMetadataRevisionsAreIndependentAndStoreCasRacesConflict()
    {
        var f = CreateFixture();
        var entry = await f.Service.CreateAsync(GlobalAdmin, 7, CreateRequest(Guid.NewGuid(), CatalogKind.Item, false, QuantityUnit.Whole, false, []), default);
        f.Store.UpdateReturnsFalse = true;
        Assert.Equal(409, (await Error(() => f.Service.UpdateMetadataAsync(GlobalAdmin, 7, entry.Entry.Id,
            new CatalogMetadataUpdateRequest { Name = "stale", ExpectedRevision = 1 }, default))).StatusCode);
        f.Store.UpdateReturnsFalse = false;
        var beforeMetadata = (await f.Service.GetAsync(GlobalAdmin, 7, entry.Entry.Id, default)).MetadataRevision;
        var content = await f.Service.UpdateContentAsync(GlobalAdmin, 7, entry.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 1, Description = "new", Attributes = [] }, default);
        Assert.Equal(2, content.ContentRevision);
        Assert.Equal(beforeMetadata, (await f.Service.GetAsync(GlobalAdmin, 7, entry.Entry.Id, default)).MetadataRevision);
        f.Content.ReplaceReturnsNull = true;
        Assert.Equal(409, (await Error(() => f.Service.UpdateContentAsync(GlobalAdmin, 7, entry.Entry.Id,
            new CatalogContentUpdateRequest { ExpectedRevision = 2, Description = "lost race", Attributes = [] }, default))).StatusCode);
        Assert.Equal(2, f.Content.ReplaceCount);
        Assert.Equal(1, f.Store.CreateCount);

        f.Store.Entries.Add(Entry(Guid.NewGuid()));
        Assert.Equal(503, (await Error(() => f.Service.GetContentAsync(GlobalAdmin, 7, f.Store.Entries.Last().Id, default))).StatusCode);
    }

    [Fact]
    public void AttributeValueAndStrictRequestPropertiesAreJsonRequired()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        foreach (var json in new[]
        {
            "{}",
            "{\"attributeId\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"typeKey\":\"integer\",\"typeRevision\":1,\"value\":0,\"editLevel\":\"Definition\"}",
            "{\"id\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"attributeId\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"typeKey\":\"integer\",\"typeRevision\":1,\"value\":0}"
        })
            Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CatalogAttributeValue>(json, options));

        const string completeValue = "{\"id\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"attributeId\":\"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\",\"typeKey\":\"integer\",\"typeRevision\":1,\"value\":0,\"editLevel\":\"Definition\"}";
        foreach (var property in new[] { "id", "attributeId", "typeKey", "typeRevision", "value", "editLevel" })
        {
            var objectValue = JsonNode.Parse(completeValue)!.AsObject();
            objectValue.Remove(property);
            Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CatalogAttributeValue>(objectValue.ToJsonString(), options));
        }

        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CatalogCreateRequest>("{\"requestId\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"name\":\"x\",\"kind\":\"Item\",\"isHidden\":false,\"allowNegative\":false,\"description\":\"\",\"attributes\":[],\"price\":1}", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CatalogMetadataUpdateRequest>("{\"name\":\"x\",\"expectedRevision\":1,\"creatorUserId\":1}", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CatalogMetadataUpdateRequest>("{\"name\":\"x\",\"expectedRevision\":1,\"kind\":\"Skill\"}", options));
        var numericEnum = JsonSerializer.Deserialize<CatalogAttributeValue>("{\"id\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"attributeId\":\"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\",\"typeKey\":\"boolean\",\"typeRevision\":1,\"value\":false,\"editLevel\":0}", options)!;
        Assert.Equal(AttributeEditLevel.Definition, numericEnum.EditLevel);
    }

    private static Fixture CreateFixture()
    {
        var baseFixture = SheetServiceTests.CreateFixture();
        var store = new FakeCatalogStore();
        var content = new FakeCatalogContentStore();
        var service = new CatalogService(new Tdn.Campaigns.Campaigns.CampaignService(baseFixture.Campaigns), store, content);
        return new Fixture(baseFixture.Campaigns, store, content, service);
    }

    private static CatalogAttributesUpdateRequest SchemaRequest(long revision, params CatalogAttributeDefinitionInput[] definitions) => new() { ExpectedRevision = revision, Definitions = definitions };
    private static CatalogAttributeDefinitionInput Def(Guid? id, string title, string type, ChoiceOption[] options, bool active = true) => new() { Id = id, Title = title, TypeKey = type, Options = options, IsActive = active };
    private static CatalogCreateRequest CreateRequest(Guid id, CatalogKind kind, bool hidden, QuantityUnit? unit, bool negative, CatalogAttributeValue[] attributes, bool includeHidden = true) => new()
    {
        RequestId = id, Name = "Catalog entry", Kind = kind, IsHidden = includeHidden ? hidden : null, QuantityUnit = unit,
        AllowNegative = negative, Description = "", Attributes = attributes
    };
    private static CatalogAttributeValue Value(Guid id, Guid attributeId, string type, long revision, string json, AttributeEditLevel level = AttributeEditLevel.Definition) => new(id, attributeId, type, revision, Json(json), level);
    private static JsonElement Json(string json) { using var document = JsonDocument.Parse(json); return document.RootElement.Clone(); }
    private static CatalogEntry Entry(Guid id, bool hidden = false, int? creator = null) => new() { Id = id, CampaignId = 7, Name = "entry", Kind = CatalogKind.Item, IsHidden = hidden, QuantityUnit = QuantityUnit.Whole, CreatorUserId = creator, MetadataRevision = 1 };
    private static async Task<DomainException> Error(Func<Task> action) => await Assert.ThrowsAsync<DomainException>(action);
    private static Task<CatalogAttributeSchemaEnvelope> Define(Fixture f, params CatalogAttributeDefinitionInput[] definitions) => f.Service.UpdateAttributesAsync(GlobalAdmin, 7, SchemaRequest(0, definitions), default);

    private sealed record Fixture(SheetServiceTests.FakeCampaignStore Campaigns, FakeCatalogStore Store, FakeCatalogContentStore Content, CatalogService Service);

    private sealed class FakeCatalogStore : ICatalogStore
    {
        public List<CatalogEntry> Entries { get; } = [];
        public int CreateCount { get; private set; }
        public bool UpdateReturnsFalse { get; set; }
        public Exception? CreateFailure { get; set; }
        public Action<CatalogEntry>? BeforeCreate { get; set; }

        public Task<IReadOnlyList<CatalogEntry>> ListAsync(int campaignId, CatalogKind? kind, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<CatalogEntry>>(Entries.Where(x => x.CampaignId == campaignId && (kind is null || x.Kind == kind)).Select(Clone).ToArray());

        public Task<CatalogEntry?> GetAsync(int campaignId, Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(Entries.Where(x => x.CampaignId == campaignId && x.Id == id).Select(Clone).SingleOrDefault());

        public Task<CatalogEntry> CreateAsync(CatalogEntry entry, CancellationToken cancellationToken)
        {
            CreateCount++;
            BeforeCreate?.Invoke(entry);
            if (CreateFailure is not null) throw CreateFailure;
            if (Entries.Any(x => x.Id == entry.Id)) throw new DuplicateResourceException();
            Entries.Add(Clone(entry));
            return Task.FromResult(Clone(entry));
        }

        public Task<bool> UpdateAsync(int campaignId, Guid id, string name, bool isHidden, QuantityUnit? quantityUnit, bool allowNegative, long expectedRevision, CancellationToken cancellationToken)
        {
            if (UpdateReturnsFalse) return Task.FromResult(false);
            var entry = Entries.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == id && x.MetadataRevision == expectedRevision);
            if (entry is null) return Task.FromResult(false);
            entry.Name = name;
            entry.IsHidden = isHidden;
            entry.QuantityUnit = quantityUnit;
            entry.AllowNegative = allowNegative;
            entry.MetadataRevision++;
            return Task.FromResult(true);
        }

        private static CatalogEntry Clone(CatalogEntry x) => new() { Id = x.Id, CampaignId = x.CampaignId, Name = x.Name, Kind = x.Kind, CreatorUserId = x.CreatorUserId, IsHidden = x.IsHidden, QuantityUnit = x.QuantityUnit, AllowNegative = x.AllowNegative, MetadataRevision = x.MetadataRevision };
    }

    private sealed class FakeCatalogContentStore : IContentStore
    {
        private readonly Dictionary<(string Collection, int CampaignId, Guid ResourceId), object> documents = [];
        public int CreateCount { get; private set; }
        public int ReplaceCount { get; private set; }
        public int WriteCount => CreateCount + ReplaceCount;
        public Exception? CreateFailure { get; set; }
        public bool ReplaceReturnsNull { get; set; }

        public T GetData<T>(string collection, int campaignId, Guid id) => ((ContentEnvelope<T>)documents[(collection, campaignId, id)]).Data;

        public Task<ContentEnvelope<T>?> GetAsync<T>(string collection, int campaignId, Guid resourceId, CancellationToken cancellationToken)
        {
            var key = (collection, campaignId, resourceId);
            return Task.FromResult(documents.TryGetValue(key, out var doc) ? (ContentEnvelope<T>?)doc : null);
        }

        public Task<ContentEnvelope<T>> CreateAsync<T>(string collection, int campaignId, Guid resourceId, T data, CancellationToken cancellationToken)
        {
            CreateCount++;
            if (CreateFailure is not null) throw CreateFailure;
            var key = (collection, campaignId, resourceId);
            if (documents.ContainsKey(key)) throw new ContentAlreadyPreparedException();
            var envelope = new ContentEnvelope<T>(campaignId, resourceId, 1, data);
            documents.Add(key, envelope);
            return Task.FromResult(envelope);
        }

        public Task<ContentEnvelope<T>?> ReplaceAsync<T>(string collection, int campaignId, Guid resourceId, long expectedRevision, T data, CancellationToken cancellationToken)
        {
            ReplaceCount++;
            if (ReplaceReturnsNull) return Task.FromResult<ContentEnvelope<T>?>(null);
            var key = (collection, campaignId, resourceId);
            if (!documents.TryGetValue(key, out var value)) return Task.FromResult<ContentEnvelope<T>?>(null);
            var current = (ContentEnvelope<T>)value;
            if (current.ContentRevision != expectedRevision) return Task.FromResult<ContentEnvelope<T>?>(null);
            var updated = new ContentEnvelope<T>(campaignId, resourceId, expectedRevision + 1, data);
            documents[key] = updated;
            return Task.FromResult<ContentEnvelope<T>?>(updated);
        }
    }
}
