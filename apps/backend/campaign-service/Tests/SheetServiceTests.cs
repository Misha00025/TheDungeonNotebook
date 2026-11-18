using System.Text.Json;
using Microsoft.Extensions.Options;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Configuration;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;
using FieldValueType = Tdn.Campaigns.Sheets.ValueType;

namespace CampaignService.Tests;

public class SheetServiceTests
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task BaseAndDescriptionUpdatesPreserveVirtualFieldsOverridesAndCustomFields()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "1"));
        var virtualField = new VirtualField(Guid.NewGuid(), "virtual", "Virtual", "", NumericResultType.Integer, Guid.NewGuid(), new(), null, null);
        var templateContent = fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty);
        await fixture.Content.ReplaceAsync("campaignTemplates", 7, Guid.Empty, 1, templateContent with { VirtualFields = [virtualField] }, default);
        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 2,
            Description = "changed",
            BaseFields = [Field(templateContent.BaseFields[0].Id, "value", FieldValueType.Integer, "2")]
        }, default);
        Assert.Equal(virtualField, fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).VirtualFields.Single());

        var character = await CreateCharacter(fixture);
        var custom = virtualField with { Id = Guid.NewGuid(), Key = "custom" };
        var sheet = fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id) with
        {
            VirtualFormulaOverrides = [new(virtualField.Id, "2")],
            CustomVirtualFields = [custom]
        };
        await fixture.Content.ReplaceAsync("characterSheets", 7, character.Id, 1, sheet, default);
        await fixture.Sheets.UpdateCharacterDescriptionAsync(Admin, 7, character.Id,
            new CharacterDescriptionRequest { Description = "description", ExpectedRevision = 2 }, default);
        await SetValue(fixture, character.Id, templateContent.BaseFields[0].Id, "3", 3);
        var stored = fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id);
        Assert.Equal("2", stored.VirtualFormulaOverrides.Single().Expression);
        Assert.Equal(custom, stored.CustomVirtualFields.Single());
    }

    [Fact]
    public async Task FormulaEditsAndOverridesUseCurrentContentWithoutComputedSheetWrites()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture);
        var formulaService = new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets);
        var formula = await formulaService.CreateAsync(Admin, 7, new FormulaCreateRequest
        {
            RequestId = Guid.NewGuid(), Name = "Value", Expression = "2", Parameters = []
        }, default);
        var virtualFields = new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets);
        var fieldInput = new VirtualFieldInput
        {
            Key = "value", Title = "Value", Description = "", ResultType = NumericResultType.Integer,
            FormulaId = formula.Id, Bindings = new()
        };
        var saved = await virtualFields.UpdateTemplateFieldsAsync(Admin, 7,
            new TemplateVirtualFieldsUpdateRequest { ExpectedRevision = 1, VirtualFields = [fieldInput] }, default);
        var character = await CreateCharacter(fixture);
        var computed = new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets);
        var writesBeforeRead = fixture.Content.WriteCount;
        var readsBeforeCalculation = fixture.Content.ReadCount;
        var first = await computed.GetAsync(Admin, 7, character.Id, default);
        Assert.Equal(2L, first.VirtualFields.Single().Value);
        Assert.Equal(writesBeforeRead, fixture.Content.WriteCount);
        Assert.Equal(readsBeforeCalculation + 3, fixture.Content.ReadCount);

        await formulaService.UpdateContentAsync(Admin, 7, formula.Id,
            new FormulaContentUpdateRequest { Expression = "4", Parameters = [], ExpectedRevision = 1 }, default);
        var second = await computed.GetAsync(Admin, 7, character.Id, default);
        Assert.Equal(4L, second.VirtualFields.Single().Value);
        Assert.Equal(1, second.ContentRevision);

        await virtualFields.SetOverrideAsync(Admin, 7, character.Id, saved.VirtualFields.Single().Id,
            new OverrideInput { Expression = "9", ExpectedRevision = 1 }, default);
        await formulaService.UpdateContentAsync(Admin, 7, formula.Id,
            new FormulaContentUpdateRequest { Expression = "5", Parameters = [], ExpectedRevision = 2 }, default);
        var overridden = await computed.GetAsync(Admin, 7, character.Id, default);
        Assert.Equal(9L, overridden.VirtualFields.Single().Value);
        Assert.Equal(2, overridden.ContentRevision);

        await virtualFields.DeleteOverrideAsync(Admin, 7, character.Id, saved.VirtualFields.Single().Id, 2, default);
        var restored = await computed.GetAsync(Admin, 7, character.Id, default);
        Assert.Equal(5L, restored.VirtualFields.Single().Value);
        Assert.Equal(3, restored.ContentRevision);
    }

    [Fact]
    public async Task FormulaDefinitionReadsUseConfiguredAccessAndCampaignScope()
    {
        var fixture = CreateFixture(membersCanReadDefinitions: false);
        var formulas = new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets);
        var forbidden = await Assert.ThrowsAsync<DomainException>(() => formulas.ListAsync(Member, 7, default));
        Assert.Equal(403, forbidden.StatusCode);
        var missing = await Assert.ThrowsAsync<DomainException>(() => formulas.ListAsync(new Subject(SubjectType.User, 999), 7, default));
        Assert.Equal(404, missing.StatusCode);
    }

    [Fact]
    public async Task CustomVirtualFieldsArePerCharacterAndStaleTemplateCasDoesNotWrite()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture);
        var formulaService = new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets);
        var formula = await formulaService.CreateAsync(Admin, 7, new FormulaCreateRequest
        {
            RequestId = Guid.NewGuid(), Name = "Value", Expression = "3", Parameters = []
        }, default);
        var fields = new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets);
        var staleWrites = fixture.Content.WriteCount;
        var conflict = await Assert.ThrowsAsync<DomainException>(() => fields.UpdateTemplateFieldsAsync(Admin, 7,
            new TemplateVirtualFieldsUpdateRequest { ExpectedRevision = 2, VirtualFields = [] }, default));
        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal(staleWrites, fixture.Content.WriteCount);

        var first = await CreateCharacter(fixture);
        var second = await CreateCharacter(fixture);
        var virtualInput = new VirtualFieldInput { Key = "custom", Title = "Custom", Description = "", ResultType = NumericResultType.Integer, FormulaId = formula.Id, Bindings = new() };
        await fields.UpdateCustomFieldsAsync(Admin, 7, first.Id,
            new VirtualFieldsUpdateRequest { ExpectedRevision = 1, VirtualFields = [virtualInput] }, default);
        Assert.Single((await fields.GetCustomFieldsAsync(Admin, 7, first.Id, default)).VirtualFields);
        Assert.Empty((await fields.GetCustomFieldsAsync(Admin, 7, second.Id, default)).VirtualFields);
        Assert.Empty(fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).VirtualFields);
    }

    [Fact]
    public async Task BaseAndVirtualFieldKeysMayMatch()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "score", FieldValueType.Integer, "1"));
        var formula = await new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets).CreateAsync(Admin, 7,
            new FormulaCreateRequest { RequestId = Guid.NewGuid(), Name = "Score", Expression = "2", Parameters = [] }, default);
        var result = await new VirtualFieldService(fixture.Resources, fixture.Content, fixture.Sheets).UpdateTemplateFieldsAsync(Admin, 7,
            new TemplateVirtualFieldsUpdateRequest
            {
                ExpectedRevision = 1,
                VirtualFields = [new VirtualFieldInput { Key = "score", Title = "Virtual score", Description = "", ResultType = NumericResultType.Integer, FormulaId = formula.Id, Bindings = new() }]
            }, default);
        Assert.Equal("score", fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).BaseFields.Single().Key);
        Assert.Equal("score", result.VirtualFields.Single().Key);
        Assert.NotEqual(fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).BaseFields.Single().Id, result.VirtualFields.Single().Id);
    }

    [Fact]
    public async Task FormulaPublicationLeavesPreparedDocumentOnUnknownSqlOutcomeAndDoesNotRetry()
    {
        var fixture = CreateFixture();
        var formulas = new FormulaService(fixture.Resources, fixture.Content, fixture.Sheets);
        var request = new FormulaCreateRequest { RequestId = Guid.NewGuid(), Name = "Formula", Expression = "1", Parameters = [] };
        fixture.Resources.FormulaCreateFailure = new CampaignStoreException(true);
        var unknown = await Assert.ThrowsAsync<DomainException>(() => formulas.CreateAsync(Admin, 7, request, default));
        Assert.Equal("publication_outcome_unknown", unknown.Code);
        Assert.NotNull(fixture.Content.GetData<FormulaContent>("formulaContents", 7, request.RequestId!.Value));
        Assert.Empty(fixture.Resources.Formulas);
        var duplicate = await Assert.ThrowsAsync<DomainException>(() => formulas.CreateAsync(Admin, 7, request, default));
        Assert.Equal("content_already_prepared", duplicate.Code);
        Assert.Empty(fixture.Resources.Formulas);
        Assert.Equal(1, fixture.Resources.FormulaCreateAttempts);
    }

    [Fact]
    public async Task CharacterStartsWithoutCopiedValuesAndReadsCurrentTemplateFallback()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "strength", FieldValueType.Integer, "2"));
        var fieldId = GetStoredField(fixture, "strength").Id;
        var character = await CreateCharacter(fixture);
        var stored = fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id);

        Assert.Empty(stored.BaseValues);
        var writes = fixture.Content.WriteCount;
        var sheet = await fixture.Sheets.GetCharacterSheetAsync(Admin, 7, character.Id, default);
        Assert.Equal(2, sheet.BaseFields.Single().EffectiveValue.GetInt64());
        Assert.False(sheet.BaseFields.Single().IsExplicit);
        Assert.Equal(writes, fixture.Content.WriteCount);

        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 1,
            Description = "Updated",
            BaseFields = [Field(fieldId, "strength", FieldValueType.Integer, "12")]
        }, default);

        var current = await fixture.Sheets.GetCharacterSheetAsync(Admin, 7, character.Id, default);
        Assert.Equal(12, current.BaseFields.Single().EffectiveValue.GetInt64());
        Assert.False(current.BaseFields.Single().IsExplicit);
        Assert.Equal(writes + 1, fixture.Content.WriteCount);
    }

    [Fact]
    public async Task ExplicitZeroFalseEmptyStringAndEmptyMultiChoiceArePreserved()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture,
            Field(null, "integer", FieldValueType.Integer, "1"),
            Field(null, "boolean", FieldValueType.Boolean, "true"),
            Field(null, "string", FieldValueType.String, "\"default\""),
            Field(null, "multi", FieldValueType.MultiChoice, "[\"a\"]", [new ChoiceOption("a", "A")]));
        var fields = fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).BaseFields.ToDictionary(x => x.Key);
        var character = await CreateCharacter(fixture);

        await SetValue(fixture, character.Id, fields["integer"].Id, "0", 1);
        await SetValue(fixture, character.Id, fields["boolean"].Id, "false", 2);
        await SetValue(fixture, character.Id, fields["string"].Id, "\"\"", 3);
        await SetValue(fixture, character.Id, fields["multi"].Id, "[]", 4);

        var effective = (await fixture.Sheets.GetCharacterSheetAsync(Admin, 7, character.Id, default)).BaseFields.ToDictionary(x => x.Key);
        Assert.Equal(0, effective["integer"].EffectiveValue.GetInt64());
        Assert.False(effective["boolean"].EffectiveValue.GetBoolean());
        Assert.Equal(string.Empty, effective["string"].EffectiveValue.GetString());
        Assert.Equal(0, effective["multi"].EffectiveValue.GetArrayLength());
        Assert.All(effective.Values, field => Assert.True(field.IsExplicit));
    }

    [Fact]
    public async Task TypeChangeAndReturnDoesNotResurrectOlderExplicitValue()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "1"));
        var fieldId = GetStoredField(fixture, "value").Id;
        var character = await CreateCharacter(fixture);
        await SetValue(fixture, character.Id, fieldId, "5", 1);

        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 1,
            Description = string.Empty,
            BaseFields = [Field(fieldId, "value", FieldValueType.String, "\"text\"")]
        }, default);
        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 2,
            Description = string.Empty,
            BaseFields = [Field(fieldId, "value", FieldValueType.Integer, "7")]
        }, default);

        var field = (await fixture.Sheets.GetCharacterSheetAsync(Admin, 7, character.Id, default)).BaseFields.Single();
        var saved = fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id).BaseValues.Single();
        Assert.Equal(3, field.TypeRevision);
        Assert.Equal(7, field.EffectiveValue.GetInt64());
        Assert.False(field.IsExplicit);
        Assert.Equal(5, saved.Value.GetInt64());
        Assert.Equal(1, saved.TypeRevision);
    }

    [Fact]
    public async Task RemovedChoiceMakesWholeExplicitMultiChoiceIncompatibleWithoutCleanup()
    {
        var fixture = CreateFixture();
        var options = new[] { new ChoiceOption("red", "Red"), new ChoiceOption("blue", "Blue") };
        await ConfigureTemplate(fixture, Field(null, "colors", FieldValueType.MultiChoice, "[\"blue\"]", options));
        var fieldId = GetStoredField(fixture, "colors").Id;
        var character = await CreateCharacter(fixture);
        await SetValue(fixture, character.Id, fieldId, "[\"red\",\"blue\"]", 1);

        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 1,
            Description = string.Empty,
            BaseFields = [Field(fieldId, "colors", FieldValueType.MultiChoice, "[\"blue\"]", [new ChoiceOption("blue", "Blue")])]
        }, default);

        var field = (await fixture.Sheets.GetCharacterSheetAsync(Admin, 7, character.Id, default)).BaseFields.Single();
        var stored = fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id).BaseValues.Single();
        Assert.Equal("[\"blue\"]", field.EffectiveValue.GetRawText());
        Assert.False(field.IsExplicit);
        Assert.Equal("[\"red\",\"blue\"]", stored.Value.GetRawText());
    }

    [Fact]
    public async Task DeletingMissingExplicitValueIsNoOpWithoutRevisionAdvance()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "3"));
        var fieldId = GetStoredField(fixture, "value").Id;
        var character = await CreateCharacter(fixture);
        var writes = fixture.Content.WriteCount;

        var response = await fixture.Sheets.DeleteBaseValueAsync(Admin, 7, character.Id, fieldId, 1, default);

        Assert.Equal(1, response.ContentRevision);
        Assert.Equal(3, response.BaseFields.Single().EffectiveValue.GetInt64());
        Assert.False(response.BaseFields.Single().IsExplicit);
        Assert.Equal(writes, fixture.Content.WriteCount);
    }

    [Fact]
    public async Task DescriptionUpdateWithFutureRevisionDoesNotReplaceDocument()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "3"));
        var character = await CreateCharacter(fixture);
        var replaceCalls = fixture.Content.ReplaceCount;

        var conflict = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateCharacterDescriptionAsync(Admin, 7, character.Id,
            new CharacterDescriptionRequest { Description = "stale", ExpectedRevision = 2 }, default));

        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal("content_revision_conflict", conflict.Code);
        Assert.Equal(replaceCalls, fixture.Content.ReplaceCount);
        Assert.Equal(string.Empty, fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id).Description);
    }

    [Fact]
    public async Task DescriptionUpdateWithStaleRevisionDoesNotReplaceDocument()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "3"));
        var character = await CreateCharacter(fixture);
        await fixture.Sheets.UpdateCharacterDescriptionAsync(Admin, 7, character.Id,
            new CharacterDescriptionRequest { Description = "current", ExpectedRevision = 1 }, default);
        var replaceCalls = fixture.Content.ReplaceCount;

        var conflict = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateCharacterDescriptionAsync(Admin, 7, character.Id,
            new CharacterDescriptionRequest { Description = "stale", ExpectedRevision = 1 }, default));

        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal(replaceCalls, fixture.Content.ReplaceCount);
        Assert.Equal("current", fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id).Description);
    }

    [Fact]
    public async Task DeletedFieldIsHiddenAndReaddingItsKeyGetsANewIdentity()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "same-key", FieldValueType.Integer, "1"));
        var fieldId = GetStoredField(fixture, "same-key").Id;
        var character = await CreateCharacter(fixture);
        await SetValue(fixture, character.Id, fieldId, "91", 1);

        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 1,
            Description = string.Empty,
            BaseFields = []
        }, default);
        Assert.Empty((await fixture.Sheets.GetCharacterSheetAsync(Admin, 7, character.Id, default)).BaseFields);

        await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7, new TemplateContentUpdateRequest
        {
            ExpectedRevision = 2,
            Description = string.Empty,
            BaseFields = [Field(null, "same-key", FieldValueType.Integer, "4")]
        }, default);

        var field = (await fixture.Sheets.GetCharacterSheetAsync(Admin, 7, character.Id, default)).BaseFields.Single();
        var stored = fixture.Content.GetData<CharacterSheet>("characterSheets", 7, character.Id);
        Assert.NotEqual(fieldId, field.Id);
        Assert.Equal(4, field.EffectiveValue.GetInt64());
        Assert.False(field.IsExplicit);
        Assert.Equal(91, stored.BaseValues.Single().Value.GetInt64());
        Assert.Equal(fieldId, stored.BaseValues.Single().BaseFieldId);
    }

    [Fact]
    public async Task ReadsDoNotWriteAndResourcesAreCampaignScoped()
    {
        var fixture = CreateFixture();
        fixture.Campaigns.SeedCampaign(8);
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "2"));
        var before = fixture.Content.WriteCount;
        await fixture.Sheets.GetTemplateContentAsync(Admin, 7, default);
        Assert.Equal(before, fixture.Content.WriteCount);

        var reads = fixture.Content.ReadCount;
        var other = await fixture.Sheets.GetTemplateContentAsync(Admin, 8, default);
        Assert.Equal(8, other.CampaignId);
        Assert.Equal(0, other.ContentRevision);
        Assert.Empty(other.Data.BaseFields);
        Assert.Equal(reads + 1, fixture.Content.ReadCount);

        var readsAfterCanonicalReads = fixture.Content.ReadCount;
        Assert.Equal(404, (await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.GetTemplateContentAsync(new Subject(SubjectType.User, 999), 7, default))).StatusCode);
        Assert.Equal(404, (await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.GetTemplateContentAsync(new Subject(SubjectType.Group, 8), 7, default))).StatusCode);
        var noDefinitionRead = CreateService(fixture.Campaigns, fixture.Resources, fixture.Content, false);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => noDefinitionRead.GetTemplateContentAsync(Member, 7, default))).StatusCode);
        Assert.Equal(readsAfterCanonicalReads, fixture.Content.ReadCount);
    }

    [Fact]
    public async Task DefinitionsReadSettingDoesNotGrantAccessToUnassignedCharactersAndCanWriteIsEnforced()
    {
        var fixture = CreateFixture(membersCanReadDefinitions: true);
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "2"));
        var character = await CreateCharacter(fixture);
        Assert.Equal(7, (await fixture.Sheets.GetTemplateAsync(Member, 7, default)).CampaignId);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.GetCharacterAsync(Member, 7, character.Id, default))).StatusCode);

        await fixture.Sheets.UpsertAssignmentAsync(Admin, 7, character.Id, 200, new AssignmentRequest { CanWrite = false, ExpectedRevision = 0 }, default);
        Assert.Single(await fixture.Sheets.ListAssignmentsAsync(Admin, 7, character.Id, default));
        var restrictive = CreateService(fixture.Campaigns, fixture.Resources, fixture.Content, false);
        await restrictive.GetCharacterSheetAsync(Member, 7, character.Id, default);
        Assert.Equal(character.Id, (await fixture.Sheets.GetCharacterAsync(Member, 7, character.Id, default)).Id);
        await fixture.Sheets.GetCharacterSheetAsync(Member, 7, character.Id, default);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateCharacterDescriptionAsync(Member, 7, character.Id,
            new CharacterDescriptionRequest { Description = "No", ExpectedRevision = 1 }, default))).StatusCode);

        await fixture.Sheets.UpsertAssignmentAsync(Admin, 7, character.Id, 200, new AssignmentRequest { CanWrite = true, ExpectedRevision = 1 }, default);
        await fixture.Sheets.UpdateCharacterDescriptionAsync(Member, 7, character.Id,
            new CharacterDescriptionRequest { Description = "Allowed", ExpectedRevision = 1 }, default);

        var staleDelete = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.DeleteAssignmentAsync(Admin, 7, character.Id, 200, 1, default));
        Assert.Equal(409, staleDelete.StatusCode);
        await fixture.Sheets.DeleteAssignmentAsync(Admin, 7, character.Id, 200, 2, default);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.GetCharacterAsync(Member, 7, character.Id, default))).StatusCode);

        var unassigned = await CreateCharacter(fixture);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => restrictive.GetTemplateAsync(Member, 7, default))).StatusCode);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => restrictive.GetCharacterAsync(Member, 7, unassigned.Id, default))).StatusCode);
    }

    [Fact]
    public async Task TemplateMetadataRenameUsesOnlySqlAndContentRevisionCasReturns409()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "2"));
        var writes = fixture.Content.WriteCount;

        var renamed = await fixture.Sheets.RenameTemplateAsync(Admin, 7,
            new TemplateRenameRequest { Name = "Renamed", ExpectedRevision = 1 }, default);
        Assert.Equal(2, renamed.MetadataRevision);
        Assert.Equal(writes, fixture.Content.WriteCount);

        var conflict = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 2, Description = string.Empty, BaseFields = [] }, default));
        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal(writes, fixture.Content.WriteCount);
    }

    [Fact]
    public async Task CharacterMetadataRenameIsSqlOnlyAndImportanceUsesConfiguredDefaultOrRequest()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "1"));
        var defaultCharacter = await CreateCharacter(fixture);
        var explicitCharacter = await fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest
        {
            RequestId = Guid.NewGuid(),
            Name = "Explicit",
            Importance = Importance.Key
        }, default);
        Assert.Equal(Importance.Background, defaultCharacter.Importance);
        Assert.Equal(Importance.Key, explicitCharacter.Importance);

        var writes = fixture.Content.WriteCount;
        var updated = await fixture.Sheets.UpdateCharacterAsync(Admin, 7, defaultCharacter.Id,
            new CharacterUpdateRequest { Name = "Renamed", Importance = Importance.Secondary, ExpectedRevision = 1 }, default);
        Assert.Equal(2, updated.MetadataRevision);
        Assert.Equal(Importance.Secondary, updated.Importance);
        Assert.Equal(writes, fixture.Content.WriteCount);
    }

    [Fact]
    public async Task AssignmentRevisionUsesInsertOnlyAndCompareAndSwap()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "value", FieldValueType.Integer, "1"));
        var character = await CreateCharacter(fixture);
        await fixture.Sheets.UpsertAssignmentAsync(Admin, 7, character.Id, 200,
            new AssignmentRequest { CanWrite = false, ExpectedRevision = 0 }, default);

        var conflict = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpsertAssignmentAsync(Admin, 7, character.Id, 200,
            new AssignmentRequest { CanWrite = true, ExpectedRevision = 2 }, default));
        Assert.Equal(409, conflict.StatusCode);
        var updated = await fixture.Sheets.UpsertAssignmentAsync(Admin, 7, character.Id, 200,
            new AssignmentRequest { CanWrite = true, ExpectedRevision = 1 }, default);
        Assert.Equal(2, updated.Assignment.MetadataRevision);
        Assert.True(updated.Assignment.CanWrite);
    }

    [Fact]
    public async Task SingletonTemplateStartsEmptyAndFirstWriteUsesRevisionZeroCompareAndSwap()
    {
        var fixture = CreateFixture();
        var metadata = await fixture.Sheets.GetTemplateAsync(Admin, 7, default);
        var initial = await fixture.Sheets.GetTemplateContentAsync(Admin, 7, default);
        Assert.Equal(7, metadata.CampaignId);
        Assert.Equal(0, initial.ContentRevision);
        Assert.Empty(initial.Data.BaseFields);
        Assert.Equal(0, fixture.Content.WriteCount);

        var first = await fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [] }, default);
        Assert.Equal(1, first.ContentRevision);
        var beforeConflict = fixture.Content.WriteCount;
        var conflict = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "overwrite", BaseFields = [] }, default));
        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal(beforeConflict, fixture.Content.WriteCount);
    }

    [Fact]
    public async Task SingletonTemplateContentCreateFailureKeepsSqlRowAndDoesNotRetry()
    {
        var fixture = CreateFixture();
        fixture.Content.CreateFailure = new ContentAlreadyPreparedException();

        var duplicate = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [] }, default));

        Assert.Equal("content_revision_conflict", duplicate.Code);
        Assert.Single(fixture.Resources.Templates);
        Assert.Equal(1, fixture.Content.CreateCount);
        Assert.Equal(1, fixture.Content.ReadCount);
    }

    [Fact]
    public async Task SingletonTemplateRejectsInvalidFieldsBeforeMongoWrite()
    {
        var fixture = CreateFixture();
        var nullEntry = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [null!] }, default));
        Assert.Equal(400, nullEntry.StatusCode);
        Assert.Equal(0, fixture.Content.WriteCount);
        var missingDescription = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = null, BaseFields = [] }, default));
        Assert.Equal(400, missingDescription.StatusCode);
        Assert.Equal(0, fixture.Content.WriteCount);
        var missingFields = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = null }, default));
        Assert.Equal(400, missingFields.StatusCode);
        Assert.Equal(0, fixture.Content.WriteCount);
        foreach (var fields in new BaseFieldInput[][]
        {
            [Field(Guid.NewGuid(), "unknown", FieldValueType.Integer, "1")],
            [Field(null, "duplicate", FieldValueType.Integer, "1"), Field(null, "duplicate", FieldValueType.Integer, "2")]
        })
        {
            var invalid = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
                new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = fields }, default));
            Assert.Equal(400, invalid.StatusCode);
            Assert.Equal(0, fixture.Content.WriteCount);
        }
    }

    [Fact]
    public async Task SingletonTemplateMongoFailuresPropagateWithoutRemovingSqlRowOrRetrying()
    {
        var fixture = CreateFixture();
        fixture.Content.CreateFailure = new ContentStoreException(true);
        await Assert.ThrowsAsync<ContentStoreException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = "", BaseFields = [] }, default));
        Assert.Single(fixture.Resources.Templates);
        Assert.Equal(1, fixture.Content.CreateCount);

        fixture.Content.CreateFailure = null;
        await ConfigureTemplate(fixture);
        fixture.Content.ReplaceFailure = new ContentStoreException(true);
        await Assert.ThrowsAsync<ContentStoreException>(() => fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 1, Description = "changed", BaseFields = [] }, default));
        Assert.Single(fixture.Resources.Templates);
        Assert.Equal(2, fixture.Content.CreateCount);
        Assert.Equal(1, fixture.Content.ReplaceCount);
    }

    [Fact]
    public async Task AssignmentRequiresExistingCampaignMember()
    {
        var fixture = CreateFixture();
        await ConfigureTemplate(fixture, Field(null, "v", FieldValueType.Integer, "1"));
        var character = await CreateCharacter(fixture);

        var missing = await Assert.ThrowsAsync<DomainException>(() => fixture.Sheets.UpsertAssignmentAsync(Admin, 7, character.Id, -1,
            new AssignmentRequest { CanWrite = true, ExpectedRevision = 0 }, default));
        Assert.Equal(404, missing.StatusCode);
        Assert.Empty(fixture.Resources.Assignments);
    }

    internal static Fixture CreateFixture(bool membersCanReadDefinitions = true)
    {
        var resources = new FakeResourceStore();
        var campaigns = new FakeCampaignStore(resources);
        campaigns.SeedCampaign(7);
        campaigns.SeedMember(7, 100, true);
        campaigns.SeedMember(7, 200, false);
        resources.SeedMember(7, 100);
        resources.SeedMember(7, 200);
        var content = new FakeContentStore();
        var sheets = CreateService(campaigns, resources, content, membersCanReadDefinitions);
        return new Fixture(campaigns, resources, content, sheets);
    }

    private static SheetService CreateService(FakeCampaignStore campaigns, FakeResourceStore resources, FakeContentStore content, bool membersCanReadDefinitions) =>
        new(new Tdn.Campaigns.Campaigns.CampaignService(campaigns), resources, content,
            Options.Create(new SheetOptions { DefaultImportance = "background", MembersCanReadDefinitions = membersCanReadDefinitions }));

    private static Task<TemplateContentEnvelope> ConfigureTemplate(Fixture fixture, params BaseFieldInput[] fields) =>
        fixture.Sheets.UpdateTemplateContentAsync(Admin, 7,
            new TemplateContentUpdateRequest { ExpectedRevision = 0, Description = string.Empty, BaseFields = fields }, default);

    private static BaseField GetStoredField(Fixture fixture, string key) =>
        fixture.Content.GetData<TemplateContent>("campaignTemplates", 7, Guid.Empty).BaseFields.Single(x => x.Key == key);

    private static Task<CharacterMetadataDto> CreateCharacter(Fixture fixture) =>
        fixture.Sheets.CreateCharacterAsync(Admin, 7, new CharacterCreateRequest
        {
            RequestId = Guid.NewGuid(),
            Name = "Character"
        }, default);

    private static BaseFieldInput Field(Guid? id, string key, FieldValueType type, string value, ChoiceOption[]? options = null) => new()
    {
        Id = id,
        Key = key,
        Title = key,
        Description = string.Empty,
        ValueType = type,
        Value = Element(value),
        Options = options ?? []
    };

    private static JsonElement Element(string value)
    {
        using var document = JsonDocument.Parse(value);
        return document.RootElement.Clone();
    }

    private static Task<CharacterSheetEnvelope> SetValue(Fixture fixture, Guid characterId, Guid fieldId, string value, long revision) =>
        fixture.Sheets.SetBaseValueAsync(Admin, 7, characterId, fieldId,
            new BaseValueRequest { Value = Element(value), ExpectedRevision = revision }, default);

    internal sealed record Fixture(FakeCampaignStore Campaigns, FakeResourceStore Resources, FakeContentStore Content, SheetService Sheets);

    internal sealed class FakeCampaignStore : ICampaignStore
    {
        private readonly FakeResourceStore _resources;
        public List<Campaign> Campaigns { get; } = [];
        public List<CampaignMember> Members { get; } = [];
        private int _nextId = 1;

        public FakeCampaignStore(FakeResourceStore resources) => _resources = resources;

        public void SeedCampaign(int id)
        {
            var campaign = new Campaign { Id = id, Name = $"Campaign {id}", CreationRequestId = Guid.NewGuid(), CreatedByType = SubjectType.User, CreatedById = 100 };
            var template = new TemplateMetadata { CampaignId = id, Campaign = campaign, Name = campaign.Name };
            campaign.Template = template;
            Campaigns.Add(campaign);
            _resources.Templates.Add(template);
            _nextId = Math.Max(_nextId, id + 1);
        }

        public void SeedMember(int campaignId, int userId, bool isAdmin) => Members.Add(new CampaignMember { CampaignId = campaignId, UserId = userId, IsAdmin = isAdmin });
        public Task<Campaign?> GetCampaignAsync(int campaignId, CancellationToken cancellationToken) => Task.FromResult(Campaigns.SingleOrDefault(x => x.Id == campaignId));
        public Task<IReadOnlyList<Campaign>> GetAllCampaignsAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<Campaign>>(Campaigns.ToArray());
        public Task<IReadOnlyList<Campaign>> GetCampaignsForUserAsync(int userId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<Campaign>>(Campaigns.Where(c => Members.Any(m => m.CampaignId == c.Id && m.UserId == userId)).ToArray());
        public Task<Campaign?> GetCampaignForUserAsync(int campaignId, int userId, CancellationToken cancellationToken) => Task.FromResult(Campaigns.SingleOrDefault(c => c.Id == campaignId && Members.Any(m => m.CampaignId == c.Id && m.UserId == userId)));
        public Task<Campaign?> GetCampaignByRequestAsync(Guid requestId, CancellationToken cancellationToken) => Task.FromResult(Campaigns.SingleOrDefault(x => x.CreationRequestId == requestId));
        public Task<CampaignMember?> GetMemberAsync(int campaignId, int userId, CancellationToken cancellationToken) => Task.FromResult(Members.SingleOrDefault(x => x.CampaignId == campaignId && x.UserId == userId));
        public Task<IReadOnlyList<CampaignMember>> GetMembersAsync(int campaignId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<CampaignMember>>(Members.Where(x => x.CampaignId == campaignId).ToArray());
        public Task<Campaign> CreateAsync(Campaign campaign, int administratorUserId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> RenameAsync(int campaignId, string name, long expectedRevision, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<MemberUpdateResult> UpsertMemberAsync(int campaignId, int userId, bool isAdmin, long expectedRevision, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> DeleteMemberAsync(int campaignId, int userId, long expectedRevision, CancellationToken cancellationToken) => throw new NotSupportedException();
    }

    internal sealed class FakeResourceStore : IResourceStore
    {
        private readonly HashSet<(int CampaignId, int UserId)> _members = [];
        public List<TemplateMetadata> Templates { get; } = [];
        public List<CharacterMetadata> Characters { get; } = [];
        public List<CharacterAssignment> Assignments { get; } = [];
        public List<FormulaMetadata> Formulas { get; } = [];
        public List<ViewMetadata> Views { get; } = [];
        public Exception? FormulaCreateFailure { get; set; }
        public int FormulaCreateAttempts { get; private set; }
        public int CharacterCreates { get; private set; }
        public Exception? ViewCreateFailure { get; set; }
        public int ViewCreates { get; private set; }

        public void SeedMember(int campaignId, int userId) => _members.Add((campaignId, userId));
        public Task<TemplateMetadata?> GetTemplateAsync(int campaignId, CancellationToken cancellationToken) => Task.FromResult(Templates.SingleOrDefault(x => x.CampaignId == campaignId));

        public Task<bool> RenameTemplateAsync(int campaignId, string name, long expectedRevision, CancellationToken cancellationToken)
        {
            var template = Templates.SingleOrDefault(x => x.CampaignId == campaignId && x.MetadataRevision == expectedRevision);
            if (template is null)
                return Task.FromResult(false);
            template.Name = name;
            template.MetadataRevision++;
            return Task.FromResult(true);
        }

        public Task<IReadOnlyList<CharacterMetadata>> ListCharactersAsync(int campaignId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<CharacterMetadata>>(Characters.Where(x => x.CampaignId == campaignId).ToArray());
        public Task<CharacterMetadata?> GetCharacterAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) => Task.FromResult(Characters.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == characterId));
        public Task<IReadOnlyList<CharacterMetadata>> ListCharactersForUserAsync(int campaignId, int userId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<CharacterMetadata>>(Characters.Where(x => x.CampaignId == campaignId && Assignments.Any(a => a.CampaignId == campaignId && a.CharacterId == x.Id && a.UserId == userId)).ToArray());

        public Task<CharacterMetadata> CreateCharacterAsync(CharacterMetadata character, CancellationToken cancellationToken)
        {
            CharacterCreates++;
            if (Characters.Any(x => x.Id == character.Id))
                throw new DuplicateResourceException();
            character.MetadataRevision = 1;
            Characters.Add(character);
            return Task.FromResult(character);
        }

        public Task<bool> UpdateCharacterAsync(int campaignId, Guid characterId, string name, Importance importance, long expectedRevision, CancellationToken cancellationToken)
        {
            var character = Characters.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == characterId && x.MetadataRevision == expectedRevision);
            if (character is null)
                return Task.FromResult(false);
            character.Name = name;
            character.Importance = importance;
            character.MetadataRevision++;
            return Task.FromResult(true);
        }

        public Task<IReadOnlyList<CharacterAssignment>> ListAssignmentsAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<CharacterAssignment>>(Assignments.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId).ToArray());
        public Task<CharacterAssignment?> GetAssignmentAsync(int campaignId, Guid characterId, int userId, CancellationToken cancellationToken) => Task.FromResult(Assignments.SingleOrDefault(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.UserId == userId));
        public Task<bool> IsCampaignMemberAsync(int campaignId, int userId, CancellationToken cancellationToken) => Task.FromResult(_members.Contains((campaignId, userId)));

        public Task<MemberUpdateResult> UpsertAssignmentAsync(int campaignId, Guid characterId, int userId, bool canWrite, long expectedRevision, CancellationToken cancellationToken)
        {
            var existing = Assignments.SingleOrDefault(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.UserId == userId);
            if (expectedRevision == 0)
            {
                if (existing is not null)
                    return Task.FromResult(new MemberUpdateResult(null, true));
                Assignments.Add(new CharacterAssignment { CampaignId = campaignId, CharacterId = characterId, UserId = userId, CanWrite = canWrite });
                return Task.FromResult(new MemberUpdateResult(1, true));
            }
            if (existing is null)
                return Task.FromResult(new MemberUpdateResult(null, false));
            if (existing.MetadataRevision != expectedRevision)
                return Task.FromResult(new MemberUpdateResult(null, true));
            existing.CanWrite = canWrite;
            existing.MetadataRevision++;
            return Task.FromResult(new MemberUpdateResult(existing.MetadataRevision, true));
        }

        public Task<bool> DeleteAssignmentAsync(int campaignId, Guid characterId, int userId, long expectedRevision, CancellationToken cancellationToken)
        {
            var assignment = Assignments.SingleOrDefault(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.UserId == userId && x.MetadataRevision == expectedRevision);
            if (assignment is null)
                return Task.FromResult(false);
            Assignments.Remove(assignment);
            return Task.FromResult(true);
        }

        public Task<IReadOnlyList<FormulaMetadata>> ListFormulasAsync(int campaignId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<FormulaMetadata>>(Formulas.Where(x => x.CampaignId == campaignId).ToArray());
        public Task<FormulaMetadata?> GetFormulaAsync(int campaignId, Guid formulaId, CancellationToken cancellationToken) => Task.FromResult(Formulas.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == formulaId));
        public Task<FormulaMetadata> CreateFormulaAsync(FormulaMetadata formula, CancellationToken cancellationToken)
        {
            FormulaCreateAttempts++;
            if (FormulaCreateFailure is not null) throw FormulaCreateFailure;
            if (Formulas.Any(x => x.Id == formula.Id)) throw new DuplicateResourceException();
            formula.MetadataRevision = 1;
            Formulas.Add(formula);
            return Task.FromResult(formula);
        }
        public Task<bool> RenameFormulaAsync(int campaignId, Guid formulaId, string name, long expectedRevision, CancellationToken cancellationToken)
        {
            var formula = Formulas.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == formulaId && x.MetadataRevision == expectedRevision);
            if (formula is null) return Task.FromResult(false);
            formula.Name = name;
            formula.MetadataRevision++;
            return Task.FromResult(true);
        }
        public Task<IReadOnlyList<ViewMetadata>> ListViewsAsync(int campaignId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<ViewMetadata>>(Views.Where(x => x.CampaignId == campaignId).ToArray());
        public Task<ViewMetadata?> GetViewAsync(int campaignId, Guid viewId, CancellationToken cancellationToken) => Task.FromResult(Views.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == viewId));
        public Task<ViewMetadata> CreateViewAsync(ViewMetadata view, CancellationToken cancellationToken)
        {
            ViewCreates++;
            if (ViewCreateFailure is not null) throw ViewCreateFailure;
            if (Views.Any(x => x.CampaignId == view.CampaignId && x.Id == view.Id)) throw new DuplicateResourceException();
            Views.Add(view);
            return Task.FromResult(view);
        }
        public Task<bool> RenameViewAsync(int campaignId, Guid viewId, string name, long expectedRevision, CancellationToken cancellationToken)
        {
            var view = Views.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == viewId && x.MetadataRevision == expectedRevision);
            if (view is null) return Task.FromResult(false);
            view.Name = name;
            view.MetadataRevision++;
            return Task.FromResult(true);
        }
    }

    internal sealed class FakeContentStore : IContentStore
    {
        private readonly Dictionary<(string Collection, int CampaignId, Guid ResourceId), object> _documents = [];
        private readonly Dictionary<(string Collection, int CampaignId, Guid ResourceId), long> _revisions = [];
        public int ReadCount { get; private set; }
        public int CreateCount { get; private set; }
        public int ReplaceCount { get; private set; }
        public int WriteCount => CreateCount + ReplaceCount;
        public Exception? CreateFailure { get; set; }
        public Exception? ReplaceFailure { get; set; }

        public T GetData<T>(string collection, int campaignId, Guid id) =>
            ((ContentEnvelope<T>)_documents[(collection, campaignId, id)]).Data;

        public Task<ContentEnvelope<T>?> GetAsync<T>(string collection, int campaignId, Guid resourceId, CancellationToken cancellationToken)
        {
            ReadCount++;
            var key = (collection, campaignId, resourceId);
            return Task.FromResult(_documents.TryGetValue(key, out var value) ? (ContentEnvelope<T>?)value : null);
        }

        public Task<ContentEnvelope<T>> CreateAsync<T>(string collection, int campaignId, Guid resourceId, T data, CancellationToken cancellationToken)
        {
            CreateCount++;
            if (CreateFailure is not null)
                throw CreateFailure;
            var key = (collection, campaignId, resourceId);
            if (_documents.ContainsKey(key))
                throw new ContentAlreadyPreparedException();
            var envelope = new ContentEnvelope<T>(campaignId, resourceId, 1, data);
            _documents.Add(key, envelope);
            _revisions.Add(key, 1);
            return Task.FromResult(envelope);
        }

        public Task<ContentEnvelope<T>?> ReplaceAsync<T>(string collection, int campaignId, Guid resourceId, long expectedRevision, T data, CancellationToken cancellationToken)
        {
            ReplaceCount++;
            if (ReplaceFailure is not null)
                throw ReplaceFailure;
            var key = (collection, campaignId, resourceId);
            if (!_documents.TryGetValue(key, out var current) || _revisions[key] != expectedRevision)
                return Task.FromResult<ContentEnvelope<T>?>(null);
            var envelope = new ContentEnvelope<T>(campaignId, resourceId, expectedRevision + 1, data);
            _documents[key] = envelope;
            _revisions[key] = envelope.ContentRevision;
            return Task.FromResult<ContentEnvelope<T>?>(envelope);
        }
    }
}
