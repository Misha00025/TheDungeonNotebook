using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Computation;

public sealed class VirtualFieldService(IResourceStore resources, IContentStore content, SheetService sheets)
{
    private const string TemplateCollection = "templateContents";
    private const string CharacterCollection = "characterSheets";
    private const string FormulaCollection = "formulaContents";

    public async Task<VirtualFieldsEnvelope> GetTemplateFieldsAsync(Subject? subject, int campaignId, Guid templateId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        await RequireTemplate(campaignId, templateId, cancellationToken);
        var current = await ReadTemplate(campaignId, templateId, cancellationToken);
        return new VirtualFieldsEnvelope(current.ContentRevision, current.Data.VirtualFields);
    }

    public async Task<VirtualFieldsEnvelope> UpdateTemplateFieldsAsync(Subject? subject, int campaignId, Guid templateId, VirtualFieldsUpdateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        await RequireTemplate(campaignId, templateId, cancellationToken);
        var current = await ReadTemplate(campaignId, templateId, cancellationToken);
        var expected = RequireRevision(request.ExpectedRevision);
        if (current.ContentRevision != expected) throw RevisionConflict(templateId);
        var fields = await ValidateFields(campaignId, request.VirtualFields!, current.Data.VirtualFields, current.Data.BaseFields,
            current.Data.VirtualFields, [], true, cancellationToken);
        var updated = current.Data with { VirtualFields = fields };
        var result = await content.ReplaceAsync(TemplateCollection, campaignId, templateId, expected, updated, cancellationToken);
        if (result is null) throw RevisionConflict(templateId);
        return new VirtualFieldsEnvelope(result.ContentRevision, result.Data.VirtualFields);
    }

    public async Task<VirtualFieldsEnvelope> GetCustomFieldsAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var inputs = await sheets.GetCalculationInputsAsync(subject, campaignId, characterId, cancellationToken);
        return new VirtualFieldsEnvelope(inputs.Sheet.ContentRevision, inputs.Sheet.Data.CustomVirtualFields);
    }

    public async Task<VirtualFieldsEnvelope> UpdateCustomFieldsAsync(Subject? subject, int campaignId, Guid characterId, VirtualFieldsUpdateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, cancellationToken);
        var inputs = await sheets.GetCalculationInputsAsync(subject, campaignId, characterId, cancellationToken);
        var expected = RequireRevision(request.ExpectedRevision);
        if (inputs.Sheet.ContentRevision != expected) throw RevisionConflict(characterId);
        var fields = await ValidateFields(campaignId, request.VirtualFields!, inputs.Sheet.Data.CustomVirtualFields,
            inputs.Template.Data.BaseFields, inputs.Template.Data.VirtualFields, inputs.Sheet.Data.CustomVirtualFields, false, cancellationToken);
        var result = await content.ReplaceAsync(CharacterCollection, campaignId, characterId, expected,
            inputs.Sheet.Data with { CustomVirtualFields = fields }, cancellationToken);
        if (result is null) throw RevisionConflict(characterId);
        return new VirtualFieldsEnvelope(result.ContentRevision, result.Data.CustomVirtualFields);
    }

    public async Task<OverridesEnvelope> GetOverridesAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var inputs = await sheets.GetCalculationInputsAsync(subject, campaignId, characterId, cancellationToken);
        var active = inputs.Template.Data.VirtualFields.Select(x => x.Id).ToHashSet();
        return new OverridesEnvelope(inputs.Sheet.ContentRevision, inputs.Sheet.Data.VirtualFormulaOverrides.Where(x => active.Contains(x.VirtualFieldId)).ToArray());
    }

    public async Task<ContentRevisionDto> SetOverrideAsync(Subject? subject, int campaignId, Guid characterId, Guid virtualFieldId, OverrideInput request, CancellationToken cancellationToken)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, cancellationToken);
        var inputs = await sheets.GetCalculationInputsAsync(subject, campaignId, characterId, cancellationToken);
        var expected = RequireRevision(request.ExpectedRevision);
        if (inputs.Sheet.ContentRevision != expected) throw RevisionConflict(characterId);
        var node = inputs.Template.Data.VirtualFields.SingleOrDefault(x => x.Id == virtualFieldId) ?? throw NotFound();
        var formula = await ReadFormula(campaignId, node.FormulaId, cancellationToken);
        var replacement = FormulaService.Validate(request.Expression, formula.Data.Parameters);
        ValidateUsedBindings(node, ExpressionAdapter.Prepare(replacement.Expression).ParameterNames, inputs.Template.Data.BaseFields,
            inputs.Template.Data.VirtualFields, [], true);
        var overrides = inputs.Sheet.Data.VirtualFormulaOverrides.Where(x => x.VirtualFieldId != virtualFieldId)
            .Append(new VirtualFormulaOverride(virtualFieldId, replacement.Expression)).ToArray();
        var result = await content.ReplaceAsync(CharacterCollection, campaignId, characterId, expected,
            inputs.Sheet.Data with { VirtualFormulaOverrides = overrides }, cancellationToken);
        if (result is null) throw RevisionConflict(characterId);
        return new ContentRevisionDto(result.ContentRevision);
    }

    public async Task<ContentRevisionDto> DeleteOverrideAsync(Subject? subject, int campaignId, Guid characterId, Guid virtualFieldId, long expectedRevision, CancellationToken cancellationToken)
    {
        await sheets.EnsureCharacterAccessAsync(subject, campaignId, characterId, true, cancellationToken);
        var inputs = await sheets.GetCalculationInputsAsync(subject, campaignId, characterId, cancellationToken);
        var expected = RequireRevision(expectedRevision);
        if (inputs.Sheet.ContentRevision != expected) throw RevisionConflict(characterId);
        if (inputs.Template.Data.VirtualFields.All(x => x.Id != virtualFieldId)) throw NotFound();
        var updated = inputs.Sheet.Data with { VirtualFormulaOverrides = inputs.Sheet.Data.VirtualFormulaOverrides.Where(x => x.VirtualFieldId != virtualFieldId).ToArray() };
        var result = await content.ReplaceAsync(CharacterCollection, campaignId, characterId, expected, updated, cancellationToken);
        if (result is null) throw RevisionConflict(characterId);
        return new ContentRevisionDto(result.ContentRevision);
    }

    private async Task<VirtualField[]> ValidateFields(int campaignId, VirtualFieldInput[] inputs, VirtualField[] oldFields,
        BaseField[] bases, VirtualField[] templateFields, VirtualField[] customFields, bool isTemplate, CancellationToken cancellationToken)
    {
        var oldById = oldFields.ToDictionary(x => x.Id);
        var ids = new HashSet<Guid>();
        var keys = new HashSet<string>(StringComparer.Ordinal);
        var allocated = new VirtualFieldInput[inputs.Length];
        for (var i = 0; i < inputs.Length; i++)
        {
            var input = inputs[i] ?? throw BadRequest("invalid_virtual_field", "Virtual field entries cannot be null.");
            if (string.IsNullOrWhiteSpace(input.Key) || input.Title is null || input.Description is null || input.ResultType is null || input.FormulaId is null || input.FormulaId == Guid.Empty || input.Bindings is null || !Enum.IsDefined(input.ResultType.Value))
                throw BadRequest("invalid_virtual_field", "Virtual field key, title, description, resultType, formulaId, and bindings are required.");
            var id = input.Id ?? Guid.NewGuid();
            if (input.Id is not null && !oldById.ContainsKey(id)) throw BadRequest("unknown_virtual_field", "The virtual field ID is not active in this context.");
            if (input.Id is null) while (oldById.ContainsKey(id) || ids.Contains(id) || !isTemplate && templateFields.Any(x => x.Id == id)) id = Guid.NewGuid();
            if (!ids.Add(id)) throw BadRequest("duplicate_virtual_field_id", "Virtual field IDs must be unique.");
            if (input.Id is not null && !string.Equals(input.Key, oldById[id].Key, StringComparison.Ordinal)) throw BadRequest("virtual_field_key_immutable", "An existing virtual field key cannot be changed.");
            if (!isTemplate && templateFields.Any(x => x.Id == id)) throw BadRequest("duplicate_virtual_field_id", "Custom virtual field IDs cannot conflict with template fields.");
            if (!keys.Add(input.Key)) throw BadRequest("duplicate_virtual_field_key", "Virtual field keys must be unique within this virtual-field set.");
            allocated[i] = input with { Id = id };
        }
        var formulaIds = allocated.Select(x => x.FormulaId!.Value).Distinct().ToArray();
        var formulaData = new Dictionary<Guid, FormulaContent>();
        foreach (var formulaId in formulaIds)
        {
            if (await resources.GetFormulaAsync(campaignId, formulaId, cancellationToken) is null) throw BadRequest("invalid_formula", "formulaId must identify a published formula in this campaign.");
            formulaData.Add(formulaId, (await ReadFormula(campaignId, formulaId, cancellationToken)).Data);
        }
        var finalTemplate = isTemplate ? allocated.Select(ToModel).ToArray() : templateFields;
        var finalCustom = isTemplate ? customFields : allocated.Select(ToModel).ToArray();
        var all = finalTemplate.Concat(finalCustom).ToArray();
        foreach (var input in allocated)
        {
            var formula = formulaData[input.FormulaId!.Value];
            var declared = formula.Parameters.ToHashSet(StringComparer.Ordinal);
            foreach (var binding in input.Bindings!)
            {
                if (string.IsNullOrWhiteSpace(binding.Key) || !declared.Contains(binding.Key) || binding.Value is null) throw BadRequest("invalid_binding", "Binding names must be declared formula parameters and references must be present.");
                ValidateReference(binding.Value, bases, finalTemplate, finalCustom, isTemplate);
            }
            if (input.ParentBaseFieldId is not null && input.ParentVirtualFieldId is not null ||
                input.Bindings!.ContainsKey("parent") && (input.ParentBaseFieldId is not null || input.ParentVirtualFieldId is not null))
                throw BadRequest("invalid_parent", "Parent may be specified only once.");
            if (input.ParentBaseFieldId is { } parentBase && bases.All(x => x.Id != parentBase)) throw BadRequest("invalid_reference", "Parent base field must be active in this context.");
            if (input.ParentVirtualFieldId is { } parentVirtual && all.All(x => x.Id != parentVirtual)) throw BadRequest("invalid_reference", "Parent virtual field must be active in this context.");
            var model = ToModel(input);
            ValidateUsedBindings(model, ExpressionAdapter.Prepare(formula.Expression).ParameterNames, bases, finalTemplate, finalCustom, isTemplate);
        }
        return allocated.Select(ToModel).ToArray();
    }

    private static void ValidateUsedBindings(VirtualField field, IReadOnlyCollection<string> used, BaseField[] bases, VirtualField[] templates, VirtualField[] customs, bool isTemplate)
    {
        if (field.ParentBaseFieldId is not null && field.ParentVirtualFieldId is not null ||
            field.Bindings.ContainsKey("parent") && (field.ParentBaseFieldId is not null || field.ParentVirtualFieldId is not null))
            throw BadRequest("invalid_parent", "Parent may be specified only once.");
        foreach (var name in used)
        {
            if (field.Bindings.TryGetValue(name, out var reference)) ValidateReference(reference, bases, templates, customs, isTemplate);
            else if (name == "parent" && field.ParentBaseFieldId is { } baseId && bases.All(x => x.Id != baseId)) throw BadRequest("invalid_reference", "Parent base field must be active in this context.");
            else if (name == "parent" && field.ParentVirtualFieldId is { } virtualId && templates.Concat(customs).All(x => x.Id != virtualId)) throw BadRequest("invalid_reference", "Parent virtual field must be active in this context.");
            else if (!field.Bindings.ContainsKey(name) && (name != "parent" || field.ParentBaseFieldId is null && field.ParentVirtualFieldId is null))
                throw BadRequest("missing_input", "Each used formula parameter requires a binding or parent reference.");
        }
    }

    private static void ValidateReference(FieldReference reference, BaseField[] bases, VirtualField[] templates, VirtualField[] customs, bool isTemplate)
    {
        if (!Enum.IsDefined(reference.Kind)) throw BadRequest("invalid_reference", "Reference kind is unknown.");
        if (reference.Kind == FieldSourceKind.Base)
        {
            if (bases.All(x => x.Id != reference.FieldId)) throw BadRequest("invalid_reference", "Referenced base field must be active in this context.");
        }
        else if (templates.Concat(isTemplate ? [] : customs).All(x => x.Id != reference.FieldId))
            throw BadRequest("invalid_reference", "Referenced virtual field must be active in this context.");
    }

    private async Task<ContentEnvelope<FormulaContent>> ReadFormula(int campaignId, Guid formulaId, CancellationToken cancellationToken)
    {
        var document = await content.GetAsync<FormulaContent>(FormulaCollection, campaignId, formulaId, cancellationToken);
        return document ?? throw new DomainException(503, "content_unavailable", "The content store does not contain the published resource.", formulaId);
    }

    private async Task<ContentEnvelope<TemplateContent>> ReadTemplate(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        await content.GetAsync<TemplateContent>(TemplateCollection, campaignId, templateId, cancellationToken) ?? throw new DomainException(503, "content_unavailable", "The content store does not contain the published resource.", templateId);
    private async Task<TemplateMetadata> RequireTemplate(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        await resources.GetTemplateAsync(campaignId, templateId, cancellationToken) ?? throw NotFound();
    private static VirtualField ToModel(VirtualFieldInput input) => new(input.Id!.Value, input.Key!, input.Title!, input.Description!, input.ResultType!.Value, input.FormulaId!.Value, input.Bindings!, input.ParentBaseFieldId, input.ParentVirtualFieldId);
    private static long RequireRevision(long? revision) => revision is > 0 ? revision.Value : throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
    private static DomainException RevisionConflict(Guid id) => new(409, "content_revision_conflict", "The content revision no longer matches.", id);
    private static DomainException NotFound() => new(404, "not_found", "The requested resource was not found.");
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
}
