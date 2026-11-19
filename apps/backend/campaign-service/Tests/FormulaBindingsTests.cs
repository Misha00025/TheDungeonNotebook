using System.Text.Json;
using System.Text.Json.Serialization;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Sheets;
using FieldValueType = Tdn.Campaigns.Sheets.ValueType;

namespace CampaignService.Tests;

public class FormulaBindingsTests
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    [Fact]
    public async Task TemplateFormulaCalculatesFromBindingsToBaseFields()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var baseFields = await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest
            {
                ExpectedRevision = 0,
                Description = string.Empty,
                BaseFields = [BaseInput("value", 2), BaseInput("strength", 3)]
            }, default);
        var formula = await CreateFormula(fixture, "value * strength", ["value", "strength"]);
        var virtualFields = new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets);
        var saved = await virtualFields.UpdateTemplateFieldsAsync(Admin, 7, new TemplateVirtualFieldsUpdateRequest
        {
            ExpectedRevision = 1,
            VirtualFields =
            [
                new VirtualFieldInput
                {
                    Key = "damage", Title = "Damage", Description = string.Empty, ResultType = NumericResultType.Integer,
                    FormulaId = formula.Id,
                    Bindings = new()
                    {
                        ["value"] = new(FieldSourceKind.Base, baseFields.Data.BaseFields.Single(x => x.Key == "value").Id),
                        ["strength"] = new(FieldSourceKind.Base, baseFields.Data.BaseFields.Single(x => x.Key == "strength").Id)
                    }
                }
            ]
        }, default);
        var character = await fixture.Sheets.CreateCharacterAsync(Admin, 7,
            new CharacterCreateRequest { RequestId = Guid.NewGuid(), Name = "Character" }, default);

        var computed = await new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets).GetAsync(Admin, 7, character.Id, default);

        Assert.Equal(6L, Assert.Single(computed.VirtualFields).Value);
        Assert.DoesNotContain("parentBaseFieldId", JsonSerializer.Serialize(saved, JsonOptions), StringComparison.Ordinal);
        Assert.DoesNotContain("parentVirtualFieldId", JsonSerializer.Serialize(saved, JsonOptions), StringComparison.Ordinal);
        var templateFields = await virtualFields.GetTemplateFieldsAsync(Admin, 7, default);
        Assert.DoesNotContain("parentBaseFieldId", JsonSerializer.Serialize(templateFields, JsonOptions), StringComparison.Ordinal);
        Assert.DoesNotContain("parentVirtualFieldId", JsonSerializer.Serialize(templateFields, JsonOptions), StringComparison.Ordinal);
        await virtualFields.UpdateCustomFieldsAsync(Admin, 7, character.Id, new VirtualFieldsUpdateRequest
        {
            ExpectedRevision = 1,
            VirtualFields = [new VirtualFieldInput
            {
                Key = "custom", Title = "Custom", Description = "", ResultType = NumericResultType.Integer,
                FormulaId = formula.Id,
                Bindings = new()
                {
                    ["value"] = new(FieldSourceKind.Base, baseFields.Data.BaseFields.Single(x => x.Key == "value").Id),
                    ["strength"] = new(FieldSourceKind.Base, baseFields.Data.BaseFields.Single(x => x.Key == "strength").Id)
                }
            }]
        }, default);
        var customFields = await virtualFields.GetCustomFieldsAsync(Admin, 7, character.Id, default);
        Assert.DoesNotContain("parentBaseFieldId", JsonSerializer.Serialize(customFields, JsonOptions), StringComparison.Ordinal);
        Assert.DoesNotContain("parentVirtualFieldId", JsonSerializer.Serialize(customFields, JsonOptions), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("parent")]
    [InlineData("value")]
    public async Task ServiceAcceptsAnyDeclaredBindingName(string name)
    {
        var fixture = SheetServiceTests.CreateFixture();
        var template = await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [BaseInput("base", 2)] }, default);
        var formula = await CreateFormula(fixture, $"{name} * 2", [name]);
        var result = await new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets).UpdateTemplateFieldsAsync(Admin, 7,
            new TemplateVirtualFieldsUpdateRequest
            {
                ExpectedRevision = template.ContentRevision,
                VirtualFields = [new VirtualFieldInput
                {
                    Key = "computed", Title = "Computed", Description = "", ResultType = NumericResultType.Integer,
                    FormulaId = formula.Id,
                    Bindings = new() { [name] = new(FieldSourceKind.Base, template.Data.BaseFields.Single().Id) }
                }]
            }, default);
        var character = await fixture.Sheets.CreateCharacterAsync(Admin, 7,
            new CharacterCreateRequest { RequestId = Guid.NewGuid(), Name = "Character" }, default);

        var computed = await new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets).GetAsync(Admin, 7, character.Id, default);

        Assert.Equal(template.Data.BaseFields.Single().Id, Assert.Single(result.VirtualFields).Bindings[name].FieldId);
        Assert.Equal(4L, Assert.Single(computed.VirtualFields).Value);
    }

    [Fact]
    public async Task MissingServiceBindingFailsBeforeContentWrite()
    {
        var fixture = SheetServiceTests.CreateFixture();
        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [] }, default);
        var formula = await CreateFormula(fixture, "parent + 1", ["parent"]);
        var writes = fixture.Content.WriteCount;

        var failure = await Assert.ThrowsAsync<DomainException>(() => new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets)
            .UpdateTemplateFieldsAsync(Admin, 7, new TemplateVirtualFieldsUpdateRequest
            {
                ExpectedRevision = 1,
                VirtualFields = [new VirtualFieldInput
                {
                    Key = "missing", Title = "Missing", Description = "", ResultType = NumericResultType.Integer,
                    FormulaId = formula.Id, Bindings = new()
                }]
            }, default));

        Assert.Equal(400, failure.StatusCode);
        Assert.Equal("missing_input", failure.Code);
        Assert.Equal(writes, fixture.Content.WriteCount);
    }

    [Fact]
    public async Task OverrideUsesExistingBindingsAndDoesNotChangeThem()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var template = await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [BaseInput("base", 2)] }, default);
        var formula = await CreateFormula(fixture, "parent + 1", ["parent"]);
        var bindings = new Dictionary<string, FieldReference> { ["parent"] = new(FieldSourceKind.Base, template.Data.BaseFields.Single().Id) };
        var virtualFields = new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets);
        var saved = await virtualFields.UpdateTemplateFieldsAsync(Admin, 7, new TemplateVirtualFieldsUpdateRequest
        {
            ExpectedRevision = template.ContentRevision,
            VirtualFields = [new VirtualFieldInput
            {
                Key = "computed", Title = "Computed", Description = "", ResultType = NumericResultType.Integer,
                FormulaId = formula.Id, Bindings = bindings
            }]
        }, default);
        var character = await fixture.Sheets.CreateCharacterAsync(Admin, 7,
            new CharacterCreateRequest { RequestId = Guid.NewGuid(), Name = "Character" }, default);

        await virtualFields.SetOverrideAsync(Admin, 7, character.Id, saved.VirtualFields.Single().Id,
            new OverrideInput { Expression = "parent * 3", ExpectedRevision = 1 }, default);

        var computed = await new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets).GetAsync(Admin, 7, character.Id, default);
        Assert.Equal(6L, Assert.Single(computed.VirtualFields).Value);
        Assert.Equal(bindings, fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).VirtualFields.Single().Bindings);
    }

    [Fact]
    public async Task OverrideCannotIntroduceAnUnboundFormulaParameter()
    {
        var fixture = SheetServiceTests.CreateFixture();
        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [] }, default);
        var formula = await CreateFormula(fixture, "1", ["parent"]);
        var fields = new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets);
        var saved = await fields.UpdateTemplateFieldsAsync(Admin, 7, new TemplateVirtualFieldsUpdateRequest
        {
            ExpectedRevision = 1,
            VirtualFields = [new VirtualFieldInput
            {
                Key = "computed", Title = "Computed", Description = "", ResultType = NumericResultType.Integer,
                FormulaId = formula.Id, Bindings = new()
            }]
        }, default);
        var character = await fixture.Sheets.CreateCharacterAsync(Admin, 7,
            new CharacterCreateRequest { RequestId = Guid.NewGuid(), Name = "Character" }, default);
        var writes = fixture.Content.WriteCount;

        var failure = await Assert.ThrowsAsync<DomainException>(() => fields.SetOverrideAsync(Admin, 7, character.Id,
            saved.VirtualFields.Single().Id, new OverrideInput { Expression = "parent + 1", ExpectedRevision = 1 }, default));

        Assert.Equal(400, failure.StatusCode);
        Assert.Equal("missing_input", failure.Code);
        Assert.Equal(writes, fixture.Content.WriteCount);
        Assert.Empty(fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id).VirtualFormulaOverrides);
        Assert.Empty(fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).VirtualFields.Single().Bindings);
    }

    [Theory]
    [InlineData("parentBaseFieldId", "null")]
    [InlineData("parentVirtualFieldId", "null")]
    public void VirtualFieldInputRejectsRemovedParentJsonFields(string property, string value)
    {
        var json = $"{{\"key\":\"x\",\"title\":\"X\",\"description\":\"\",\"resultType\":\"Integer\",\"formulaId\":\"{Guid.NewGuid()}\",\"bindings\":{{}},\"{property}\":{value}}}";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<VirtualFieldInput>(json, JsonOptions));
    }

    [Theory]
    [InlineData("parentBaseFieldId")]
    [InlineData("parentVirtualFieldId")]
    public void UpdateRequestsRejectNestedLegacyParentJsonFields(string property)
    {
        var field = $"{{\"key\":\"x\",\"title\":\"X\",\"description\":\"\",\"resultType\":\"Integer\",\"formulaId\":\"{Guid.NewGuid()}\",\"bindings\":{{}},\"{property}\":null}}";
        var templateRequest = $"{{\"expectedRevision\":0,\"virtualFields\":[{field}]}}";
        var customRequest = $"{{\"expectedRevision\":1,\"virtualFields\":[{field}]}}";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<TemplateVirtualFieldsUpdateRequest>(templateRequest, JsonOptions));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<VirtualFieldsUpdateRequest>(customRequest, JsonOptions));
    }

    [Fact]
    public void BindingsNamedParentDeserializeAndModelsExposeOnlyOrdinaryBindingProperties()
    {
        var id = Guid.NewGuid();
        var inputJson = $"{{\"key\":\"x\",\"title\":\"X\",\"description\":\"\",\"resultType\":\"Integer\",\"formulaId\":\"{Guid.NewGuid()}\",\"bindings\":{{\"parent\":{{\"kind\":\"Base\",\"fieldId\":\"{id}\"}}}}}}";
        var input = JsonSerializer.Deserialize<VirtualFieldInput>(inputJson, JsonOptions)!;
        Assert.Equal(id, input.Bindings!["parent"].FieldId);
        var expectedProperties = new[] { "id", "key", "title", "description", "resultType", "formulaId", "bindings" }
            .Order(StringComparer.Ordinal).ToArray();
        Assert.Equal(expectedProperties, typeof(VirtualField).GetProperties()
            .Select(x => char.ToLowerInvariant(x.Name[0]) + x.Name[1..]).Order(StringComparer.Ordinal).ToArray());
        Assert.Equal(expectedProperties, typeof(VirtualFieldInput).GetProperties()
            .Select(x => char.ToLowerInvariant(x.Name[0]) + x.Name[1..]).Order(StringComparer.Ordinal).ToArray());

        var field = new VirtualField(Guid.NewGuid(), "x", "X", "", NumericResultType.Integer, Guid.NewGuid(),
            new() { ["parent"] = new(FieldSourceKind.Base, id) });
        foreach (var serialized in new[] { JsonSerializer.Serialize(field, JsonOptions), JsonSerializer.Serialize(input, JsonOptions) })
        {
            Assert.DoesNotContain("parentBaseFieldId", serialized, StringComparison.Ordinal);
            Assert.DoesNotContain("parentVirtualFieldId", serialized, StringComparison.Ordinal);
        }
        Assert.Contains("parent", JsonSerializer.Serialize(field, JsonOptions), StringComparison.Ordinal);
    }

    private static async Task<FormulaCreateDto> CreateFormula(SheetServiceTests.Fixture fixture, string expression, string[] parameters) =>
        await new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets).CreateAsync(Admin, 7,
            new FormulaCreateRequest { RequestId = Guid.NewGuid(), Name = "Formula", Expression = expression, Parameters = parameters }, default);

    private static BaseFieldInput BaseInput(string key, long value)
    {
        using var document = JsonDocument.Parse(value.ToString(System.Globalization.CultureInfo.InvariantCulture));
        return new BaseFieldInput
        {
            Key = key, Title = key, Description = "", ValueType = FieldValueType.Integer,
            Value = document.RootElement.Clone(), Options = []
        };
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}
