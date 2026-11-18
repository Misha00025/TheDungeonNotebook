using System.Text.Json;
using System.Text.Json.Serialization;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Sheets;
using Tdn.Campaigns.Views;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using FieldValueType = Tdn.Campaigns.Sheets.ValueType;

namespace CampaignService.Tests;

public class ViewServiceTests
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);

    [Fact]
    public void WebJsonRequiresExplicitWidgetSourceKindWithoutInterpretingOpaqueFields()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        const string json = """
            {"roots":[{"kind":"layout","nodeKey":"root","title":"Root","params":{"unknown":{"nested":[1,null,"text"]}},"children":[{"kind":"widget","nodeKey":"outer","title":"Outer","params":null,"children":[{"kind":"widget","nodeKey":"inner","title":"Inner","params":{"id":"a1b2c3d4-e5f6-4789-8abc-def012345678"},"children":[],"sources":[{"kind":"Base","fieldId":"b1b2c3d4-e5f6-4789-8abc-def012345678"}],"format":"$1 (${2:s}) %q"}],"sources":[],"format":"opaque"}]}]}
            """;

        var view = JsonSerializer.Deserialize<ViewContent>(json, options)!;
        var outer = Assert.IsType<WidgetNode>(Assert.IsType<LayoutNode>(view.Roots.Single()).Children.Single());
        var inner = Assert.IsType<WidgetNode>(outer.Children.Single());
        Assert.Equal(FieldSourceKind.Base, Assert.Single(inner.Sources).Kind);
        Assert.Equal("$1 (${2:s}) %q", inner.Format);
        Assert.Equal(JsonValueKind.Array, Assert.IsType<LayoutNode>(view.Roots.Single()).Params.GetProperty("unknown").GetProperty("nested").ValueKind);

        var missingSourceKind = json.Replace("\"kind\":\"Base\",", "", StringComparison.Ordinal);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ViewContent>(missingSourceKind, options));
        var legacySelector = json.Replace("\"kind\":\"Base\",", "\"templateId\":\"a1b2c3d4-e5f6-4789-8abc-def012345678\",\"kind\":\"Base\",", StringComparison.Ordinal);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ViewContent>(legacySelector, options));
    }

    [Fact]
    public async Task NestedNodesPreserveOrderNativeParamsAndOpaqueFormatThroughJsonRoundTrip()
    {
        var fixture = SheetServiceTests.CreateFixture();
        await CreateTemplate(fixture);
        var baseId = fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).BaseFields.Single().Id;
        var nestedWidget = new WidgetNode("nested-widget", "Nested widget", Json("[1, true, null, {\"unknown\":\"value\"}]"),
            [new LayoutNode("nested-layout", "Nested layout", Json("null"), [])], [new WidgetSource(FieldSourceKind.Base, baseId)], "$1 (${2:s})");
        var widget = new WidgetNode("widget", "Widget title", Json("{\"unknown\":{\"id\":\"" + Guid.NewGuid().ToString("D") + "\"},\"number\":1234567890123456789}"),
            [nestedWidget], [], "format-with-unknown-%q syntax");
        var roots = new ViewNode[]
        {
            new LayoutNode("root", "Root layout", Json("{\"array\":[\"x\",2],\"flag\":false}"), [widget, new LayoutNode("last", "Last", Json("\"text\""), [])])
        };
        var service = CreateViewService(fixture);

        var result = await service.CreateAsync(Admin, 7, new ViewCreateRequest { RequestId = Guid.NewGuid(), Name = "Nested", Roots = roots }, default);
        var envelope = await service.GetContentAsync(Admin, 7, result.Id, default);
        var roundTrip = JsonSerializer.Deserialize<ViewContent>(JsonSerializer.Serialize(envelope.Data))!;

        var root = Assert.IsType<LayoutNode>(roundTrip.Roots.Single());
        Assert.Equal(new[] { "widget", "last" }, root.Children.Select(x => x.NodeKey));
        var outer = Assert.IsType<WidgetNode>(root.Children[0]);
        Assert.Equal("Widget title", outer.Title);
        Assert.Equal("format-with-unknown-%q syntax", outer.Format);
        var inner = Assert.IsType<WidgetNode>(outer.Children.Single());
        Assert.Equal("Nested widget", inner.Title);
        Assert.Equal("$1 (${2:s})", inner.Format);
        Assert.Equal(baseId, Assert.Single(inner.Sources).FieldId);
        Assert.Equal("nested-layout", Assert.IsType<LayoutNode>(inner.Children.Single()).NodeKey);
        Assert.Equal(JsonValueKind.Number, outer.Params.GetProperty("number").ValueKind);
        Assert.Equal("1234567890123456789", outer.Params.GetProperty("number").GetRawText());
        Assert.Equal(JsonValueKind.Null, inner.Params.EnumerateArray().ElementAt(2).ValueKind);

        var bson = BsonDocument.Parse(JsonSerializer.Serialize(envelope.Data));
        Assert.False(bson["Roots"].AsBsonArray[0]["Params"].AsBsonDocument["flag"].AsBoolean);
        Assert.Equal(1234567890123456789L, bson["Roots"].AsBsonArray[0]["Children"].AsBsonArray[0]["Params"].AsBsonDocument["number"].AsInt64);
        var bsonRoundTrip = JsonSerializer.Deserialize<ViewContent>(bson.ToJson(new JsonWriterSettings { OutputMode = JsonOutputMode.RelaxedExtendedJson }))!;
        Assert.Equal("1234567890123456789", Assert.IsType<WidgetNode>(Assert.IsType<LayoutNode>(bsonRoundTrip.Roots.Single()).Children[0]).Params.GetProperty("number").GetRawText());
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ViewNode>("{\"kind\":\"layout\",\"nodeKey\":\"x\",\"title\":\"x\",\"params\":null,\"children\":[],\"sources\":[],\"format\":\"x\"}"));
    }

    [Fact]
    public async Task NestedWidgetSourcesAreValidatedAndProjectionReturnsOnlyDeclaredSources()
    {
        var fixture = SheetServiceTests.CreateFixture();
        await CreateTemplate(fixture);
        var template = fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty);
        var characterId = Guid.NewGuid();
        await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest
        {
            RequestId = characterId, Name = "Character"
        }, default);
        var source = new WidgetSource(FieldSourceKind.Base, template.BaseFields.Single().Id);
        var roots = new ViewNode[]
        {
            new LayoutNode("root", "Root", Json("{\"looksLikeGuid\":\"" + Guid.NewGuid().ToString("D") + "\"}"),
                [new LayoutNode("layout", "Layout", Json("{}"), [new WidgetNode("widget", "Widget", Json("[]"), [], [source], "" )])])
        };
        var service = CreateViewService(fixture);
        var view = await service.CreateAsync(Admin, 7, new ViewCreateRequest { RequestId = Guid.NewGuid(), Name = "Sources", Roots = roots }, default);

        var projection = await service.GetSourcesAsync(Admin, 7, view.Id, characterId, default);

        var sourceProjection = Assert.Single(Assert.Single(projection.Widgets).Sources);
        Assert.Equal(source, sourceProjection.Source);
        Assert.Equal("1", sourceProjection.Value!.Value.GetRawText());
        Assert.Null(sourceProjection.Diagnostic);
        var writesBeforeRead = fixture.Content.WriteCount;
        await service.GetSourcesAsync(Admin, 7, view.Id, characterId, default);
        Assert.Equal(writesBeforeRead, fixture.Content.WriteCount);
        var invalid = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(Admin, 7,
            new ViewCreateRequest
            {
                RequestId = Guid.NewGuid(), Name = "Invalid", Roots = [new WidgetNode("bad", "Bad", Json("{}"), [],
                    [new WidgetSource(FieldSourceKind.Base, Guid.NewGuid())], "")]
            }, default));
        Assert.Equal("invalid_source", invalid.Code);

        var formula = await new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets).CreateAsync(Admin, 7,
            new FormulaCreateRequest { RequestId = Guid.NewGuid(), Name = "Custom", Expression = "2", Parameters = [] }, default);
        var customFields = new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets);
        var custom = await customFields.UpdateCustomFieldsAsync(Admin, 7, characterId,
            new VirtualFieldsUpdateRequest
            {
                ExpectedRevision = 1,
                VirtualFields = [new VirtualFieldInput { Key = "custom", Title = "Custom", Description = "", ResultType = NumericResultType.Integer, FormulaId = formula.Id, Bindings = new() }]
            }, default);
        var customSource = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(Admin, 7,
            new ViewCreateRequest
            {
                RequestId = Guid.NewGuid(), Name = "Custom source", Roots = [new WidgetNode("custom", "Custom", Json("{}"), [],
                    [new WidgetSource(FieldSourceKind.Virtual, custom.VirtualFields.Single().Id)], "")]
            }, default));
        Assert.Equal("invalid_source", customSource.Code);

        fixture.Campaigns.SeedCampaign(8);
        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 8, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 0,
            Description = "",
            BaseFields = [new BaseFieldInput { Key = "foreign", Title = "Foreign", Description = "", ValueType = FieldValueType.Integer, Value = Json("1"), Options = [] }]
        }, default);
        var foreignFieldId = fixture.Content.GetData<TemplateContent>("campaignTemplates", 8, Guid.Empty).BaseFields.Single().Id;
        var crossCampaign = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(Admin, 7,
            new ViewCreateRequest
            {
                RequestId = Guid.NewGuid(), Name = "Cross campaign", Roots = [new WidgetNode("foreign", "Foreign", Json("{}"), [],
                    [new WidgetSource(FieldSourceKind.Base, foreignFieldId)], "")]
            }, default));
        Assert.Equal("invalid_source", crossCampaign.Code);
    }

    [Fact]
    public async Task DuplicateNodeKeysAreRejectedAndUnknownSqlPublicationLeavesPreparedContent()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var service = CreateViewService(fixture);
        var duplicate = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(Admin, 7,
            new ViewCreateRequest
            {
                RequestId = Guid.NewGuid(), Name = "Duplicate", Roots =
                [new LayoutNode("same", "one", Json("{}"), []), new LayoutNode("same", "two", Json("{}"), [])]
            }, default));
        Assert.Equal(400, duplicate.StatusCode);

        var id = Guid.NewGuid();
        fixture.Resources.ViewCreateFailure = new Microsoft.EntityFrameworkCore.DbUpdateException("unknown outcome");
        var unknown = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(Admin, 7,
            new ViewCreateRequest { RequestId = id, Name = "Uncertain", Roots = [] }, default));
        Assert.Equal(503, unknown.StatusCode);
        Assert.Equal(id, Assert.IsType<Guid>(unknown.ResourceId));
        Assert.Equal(1, fixture.Resources.ViewCreates);
        Assert.Equal(1, fixture.Content.CreateCount);
        var retry = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(Admin, 7,
            new ViewCreateRequest { RequestId = id, Name = "Uncertain", Roots = [] }, default));
        Assert.Equal("content_already_prepared", retry.Code);
        Assert.Equal(1, fixture.Resources.ViewCreates);
        Assert.Equal(2, fixture.Content.CreateCount);

        var preparedFixture = SheetServiceTests.CreateFixture();
        preparedFixture.Content.CreateFailure = new ContentAlreadyPreparedException();
        var preparedService = CreateViewService(preparedFixture);
        var prepared = await Assert.ThrowsAsync<DomainException>(() => preparedService.CreateAsync(Admin, 7,
            new ViewCreateRequest { RequestId = Guid.NewGuid(), Name = "Prepared", Roots = [] }, default));
        Assert.Equal(409, prepared.StatusCode);
        Assert.Equal(0, preparedFixture.Resources.ViewCreates);
    }

    [Fact]
    public async Task MetadataRenameDoesNotWriteContentAndContentUsesCompareAndSwap()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var service = CreateViewService(fixture);
        var view = await service.CreateAsync(Admin, 7,
            new ViewCreateRequest { RequestId = Guid.NewGuid(), Name = "Original", Roots = [] }, default);
        var contentWrites = fixture.Content.WriteCount;

        var renamed = await service.RenameAsync(Admin, 7, view.Id,
            new ViewMetadataUpdateRequest { Name = "Renamed", ExpectedRevision = 1 }, default);
        Assert.Equal(2, renamed.MetadataRevision);
        Assert.Equal(contentWrites, fixture.Content.WriteCount);

        var updated = await service.UpdateContentAsync(Admin, 7, view.Id,
            new ViewContentUpdateRequest { ExpectedRevision = 1, Roots = [new LayoutNode("next", "Next", Json("null"), [])] }, default);
        Assert.Equal(2, updated.ContentRevision);
        var conflict = await Assert.ThrowsAsync<DomainException>(() => service.UpdateContentAsync(Admin, 7, view.Id,
            new ViewContentUpdateRequest { ExpectedRevision = 1, Roots = [] }, default));
        Assert.Equal(409, conflict.StatusCode);
    }

    [Fact]
    public async Task MultipleCharactersResolveExplicitValuesFromOneCampaignTemplate()
    {
        var fixture = SheetServiceTests.CreateFixture();
        await CreateTemplate(fixture);
        var template = fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty);
        var first = await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest { RequestId = Guid.NewGuid(), Name = "First" }, default);
        var second = await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest { RequestId = Guid.NewGuid(), Name = "Second" }, default);
        await fixture.Sheets.SetBaseValueAsync(Admin, 7, first.Id, template.BaseFields[0].Id,
            new BaseValueRequest { Value = Json("99"), ExpectedRevision = 1 }, default);

        var service = CreateViewService(fixture);
        var view = await service.CreateAsync(Admin, 7, new ViewCreateRequest
        {
            RequestId = Guid.NewGuid(), Name = "Sources",
            Roots = [new WidgetNode("w", "Widget", Json("{}"), [], [new WidgetSource(FieldSourceKind.Base, template.BaseFields[0].Id)], "")]
        }, default);

        var firstProjection = await service.GetSourcesAsync(Admin, 7, view.Id, first.Id, default);
        var secondProjection = await service.GetSourcesAsync(Admin, 7, view.Id, second.Id, default);
        Assert.Equal("99", Assert.Single(Assert.Single(firstProjection.Widgets).Sources).Value!.Value.GetRawText());
        Assert.Equal("1", Assert.Single(Assert.Single(secondProjection.Widgets).Sources).Value!.Value.GetRawText());
    }

    [Fact]
    public async Task DeletedTemplateVirtualFieldDoesNotResolveFromCharacterCustomFields()
    {
        var fixture = SheetServiceTests.CreateFixture();
        await CreateTemplate(fixture);
        var formula = await new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets).CreateAsync(Admin, 7,
            new FormulaCreateRequest { RequestId = Guid.NewGuid(), Name = "Value", Expression = "7", Parameters = [] }, default);
        var virtualField = new VirtualField(Guid.NewGuid(), "shared", "Shared", "", NumericResultType.Integer, formula.Id, new(), null, null);
        var template = fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty);
        await fixture.Content.ReplaceAsync("campaignTemplates", 7, Guid.Empty, 1, template with { VirtualFields = [virtualField] }, default);
        var character = await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest { RequestId = Guid.NewGuid(), Name = "Character" }, default);
        var sheet = fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id);
        await fixture.Content.ReplaceAsync("characterSheets", 7, character.Id, 1, sheet with { CustomVirtualFields = [virtualField] }, default);
        var viewId = Guid.NewGuid();
        fixture.Resources.Views.Add(new ViewMetadata { Id = viewId, CampaignId = 7, Name = "Sources" });
        await fixture.Content.CreateAsync("viewContents", 7, viewId, new ViewContent([
            new WidgetNode("w", "Widget", Json("{}"), [], [new WidgetSource(FieldSourceKind.Virtual, virtualField.Id)], "")]), default);

        await new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets).UpdateTemplateFieldsAsync(Admin, 7,
            new TemplateVirtualFieldsUpdateRequest { ExpectedRevision = 2, VirtualFields = [] }, default);
        var projection = await CreateViewService(fixture).GetSourcesAsync(Admin, 7, viewId, character.Id, default);
        var resolved = Assert.Single(Assert.Single(projection.Widgets).Sources);
        Assert.Equal("unknown_reference", resolved.Diagnostic!.Code);
        Assert.Null(resolved.Value);
    }

    [Fact]
    public async Task DefinitionReadPermissionDoesNotGrantUnassignedCharacterAccess()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var service = CreateViewService(fixture);
        var view = await service.CreateAsync(Admin, 7,
            new ViewCreateRequest { RequestId = Guid.NewGuid(), Name = "Empty", Roots = [] }, default);
        await CreateTemplate(fixture);
        var character = await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest
        {
            RequestId = Guid.NewGuid(), Name = "Unassigned"
        }, default);
        var member = new Subject(SubjectType.User, 200);

        Assert.Single(await service.ListAsync(member, 7, default));
        var forbidden = await Assert.ThrowsAsync<DomainException>(() => service.GetSourcesAsync(member, 7, view.Id, character.Id, default));
        Assert.Equal(403, forbidden.StatusCode);
        var missing = await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(Admin, 8, view.Id, default));
        Assert.Equal(404, missing.StatusCode);
    }

    private static ViewService CreateViewService(SheetServiceTests.Fixture fixture) =>
        new(fixture.Resources, fixture.Content, fixture.Sheets, new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets));

    private static Task<TemplateContentEnvelope> CreateTemplate(SheetServiceTests.Fixture fixture)
    {
        return fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 0,
            Description = "",
            BaseFields = [new BaseFieldInput
            {
                Id = null, Key = "value", Title = "Value", Description = "", ValueType = FieldValueType.Integer,
                Value = Json("1"), Options = []
            }]
        }, default);
    }

    private static JsonElement Json(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
