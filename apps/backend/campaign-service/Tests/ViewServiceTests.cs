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
            {"roots":[{"kind":"layout","nodeKey":"root","title":"Root","params":{"unknown":{"nested":[1,null,"text"]}},"children":[{"kind":"widget","nodeKey":"outer","title":"Outer","params":null,"children":[{"kind":"widget","nodeKey":"inner","title":"Inner","params":{"id":"a1b2c3d4-e5f6-4789-8abc-def012345678"},"children":[],"sources":[{"templateId":"a1b2c3d4-e5f6-4789-8abc-def012345678","kind":"Base","fieldId":"b1b2c3d4-e5f6-4789-8abc-def012345678"}],"format":"$1 (${2:s}) %q"}],"sources":[],"format":"opaque"}]}]}
            """;

        var view = JsonSerializer.Deserialize<ViewContent>(json, options)!;
        var outer = Assert.IsType<WidgetNode>(Assert.IsType<LayoutNode>(view.Roots.Single()).Children.Single());
        var inner = Assert.IsType<WidgetNode>(outer.Children.Single());
        Assert.Equal(FieldSourceKind.Base, Assert.Single(inner.Sources).Kind);
        Assert.Equal("$1 (${2:s}) %q", inner.Format);
        Assert.Equal(JsonValueKind.Array, Assert.IsType<LayoutNode>(view.Roots.Single()).Params.GetProperty("unknown").GetProperty("nested").ValueKind);

        var missingSourceKind = json.Replace("\"kind\":\"Base\",", "", StringComparison.Ordinal);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ViewContent>(missingSourceKind, options));
    }

    [Fact]
    public async Task NestedNodesPreserveOrderNativeParamsAndOpaqueFormatThroughJsonRoundTrip()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var templateId = await CreateTemplate(fixture);
        var baseId = fixture.Content.GetData<TemplateContent>("templateContents", 7, templateId).BaseFields.Single().Id;
        var nestedWidget = new WidgetNode("nested-widget", "Nested widget", Json("[1, true, null, {\"unknown\":\"value\"}]"),
            [new LayoutNode("nested-layout", "Nested layout", Json("null"), [])], [new WidgetSource(templateId, FieldSourceKind.Base, baseId)], "$1 (${2:s})");
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
        var templateId = await CreateTemplate(fixture);
        var template = fixture.Content.GetData<TemplateContent>("templateContents", 7, templateId);
        var characterId = Guid.NewGuid();
        await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest
        {
            RequestId = characterId, Name = "Character", TemplateId = templateId
        }, default);
        var source = new WidgetSource(templateId, FieldSourceKind.Base, template.BaseFields.Single().Id);
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
                    [new WidgetSource(templateId, FieldSourceKind.Base, Guid.NewGuid())], "")]
            }, default));
        Assert.Equal("invalid_source", invalid.Code);

        var foreignTemplateId = Guid.NewGuid();
        fixture.Resources.Templates.Add(new TemplateMetadata { Id = foreignTemplateId, CampaignId = 8, Name = "Foreign" });
        var crossCampaign = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(Admin, 7,
            new ViewCreateRequest
            {
                RequestId = Guid.NewGuid(), Name = "Cross campaign", Roots = [new WidgetNode("foreign", "Foreign", Json("{}"), [],
                    [new WidgetSource(foreignTemplateId, FieldSourceKind.Base, Guid.NewGuid())], "")]
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
    public async Task ProjectionDoesNotSearchOtherTemplateFieldsOrResolveDeletedOrWrongKindReferences()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var characterTemplateId = await CreateTemplate(fixture);
        var otherTemplateId = await CreateTemplate(fixture);
        var characterTemplate = fixture.Content.GetData<TemplateContent>("templateContents", 7, characterTemplateId);
        var otherTemplate = fixture.Content.GetData<TemplateContent>("templateContents", 7, otherTemplateId);
        var characterId = Guid.NewGuid();
        await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest
        {
            RequestId = characterId, Name = "Character", TemplateId = characterTemplateId
        }, default);
        await fixture.Sheets.SetBaseValueAsync(Admin, 7, characterId, characterTemplate.BaseFields[0].Id,
            new BaseValueRequest { Value = Json("99"), ExpectedRevision = 1 }, default);

        var wrongKindId = characterTemplate.BaseFields[0].Id;
        var viewId = Guid.NewGuid();
        fixture.Resources.Views.Add(new ViewMetadata { Id = viewId, CampaignId = 7, Name = "Sources" });
        var widget = new WidgetNode("w", "Widget", Json("{\"reference\":\"" + wrongKindId.ToString("D") + "\"}"), [],
            [new WidgetSource(otherTemplateId, FieldSourceKind.Base, otherTemplate.BaseFields[0].Id),
             new WidgetSource(characterTemplateId, FieldSourceKind.Base, wrongKindId),
             new WidgetSource(characterTemplateId, FieldSourceKind.Virtual, wrongKindId)],
            "${unknown-reference:" + wrongKindId.ToString("D") + "}");
        await fixture.Content.CreateAsync("viewContents", 7, viewId, new ViewContent([widget]), default);
        var service = CreateViewService(fixture);

        var projection = await service.GetSourcesAsync(Admin, 7, viewId, characterId, default);
        Assert.Equal(3, Assert.Single(projection.Widgets).Sources.Count);
        Assert.Equal("not_in_context", projection.Widgets[0].Sources[0].Diagnostic!.Code);
        Assert.Equal("99", projection.Widgets[0].Sources[1].Value!.Value.GetRawText());
        Assert.Equal("unknown_reference", projection.Widgets[0].Sources[2].Diagnostic!.Code);

        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, characterTemplateId,
            new TemplateContentUpdateRequest { ExpectedRevision = 1, Description = "", BaseFields = [] }, default);
        var afterDelete = await service.GetSourcesAsync(Admin, 7, viewId, characterId, default);
        Assert.Equal("unknown_reference", afterDelete.Widgets[0].Sources[1].Diagnostic!.Code);
        Assert.Null(afterDelete.Widgets[0].Sources[1].Value);
    }

    [Fact]
    public async Task DefinitionReadPermissionDoesNotGrantUnassignedCharacterAccess()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var service = CreateViewService(fixture);
        var view = await service.CreateAsync(Admin, 7,
            new ViewCreateRequest { RequestId = Guid.NewGuid(), Name = "Empty", Roots = [] }, default);
        var templateId = await CreateTemplate(fixture);
        var character = await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest
        {
            RequestId = Guid.NewGuid(), Name = "Unassigned", TemplateId = templateId
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

    private static async Task<Guid> CreateTemplate(SheetServiceTests.Fixture fixture)
    {
        var templateId = Guid.NewGuid();
        await fixture.Sheets.CreateTemplateAsync(Admin, 7, new TemplateCreateRequest
        {
            RequestId = templateId,
            Name = "Template",
            Description = "",
            BaseFields = [new BaseFieldInput
            {
                Id = null, Key = "value", Title = "Value", Description = "", ValueType = FieldValueType.Integer,
                Value = Json("1"), Options = []
            }]
        }, default);
        return templateId;
    }

    private static JsonElement Json(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
