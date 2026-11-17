using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Configuration;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Sheets;

public sealed class SheetService(
    CampaignService campaignService,
    IResourceStore resources,
    IContentStore content,
    IOptions<SheetOptions> options)
{
    private const string TemplateCollection = "templateContents";
    private const string CharacterCollection = "characterSheets";

    public async Task<IReadOnlyList<TemplateMetadataDto>> ListTemplatesAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        await RequireDefinitionsReadAsync(subject, campaignId, cancellationToken);
        return (await resources.ListTemplatesAsync(campaignId, cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task<TemplateCreateDto> CreateTemplateAsync(Subject? subject, int campaignId, TemplateCreateRequest request, CancellationToken cancellationToken)
    {
        await RequireAdminAsync(subject, campaignId, cancellationToken);
        RequireName(request.Name);
        var requestId = RequireRequestId(request.RequestId);
        if (request.Description is null || request.BaseFields is null)
            throw BadRequest("invalid_template", "description and baseFields are required.");
        var existing = await resources.GetTemplateAsync(campaignId, requestId, cancellationToken);
        if (existing is not null)
            throw AlreadyPublished(requestId);
        var data = new TemplateContent(request.Description, BuildFields(request.BaseFields, []));
        ContentEnvelope<TemplateContent> prepared;
        try
        {
            prepared = await content.CreateAsync(TemplateCollection, campaignId, requestId, data, cancellationToken);
        }
        catch (ContentAlreadyPreparedException)
        {
            throw new DomainException(409, "content_already_prepared", "Content for this resource is already prepared.", requestId, requestId);
        }

        var metadata = new TemplateMetadata { Id = requestId, CampaignId = campaignId, Name = request.Name! };
        try
        {
            var created = await resources.CreateTemplateAsync(metadata, cancellationToken);
            var dto = ToDto(created);
            return new TemplateCreateDto(dto.Id, dto.Key, dto.CampaignId, dto.Name, dto.MetadataRevision, prepared.ContentRevision);
        }
        catch (DuplicateResourceException)
        {
            throw AlreadyPublished(requestId);
        }
        catch (Exception exception) when (IsSqlWriteFailure(exception))
        {
            throw PublicationOutcomeUnknown(requestId);
        }
    }

    public async Task<TemplateMetadataDto> GetTemplateAsync(Subject? subject, int campaignId, Guid templateId, CancellationToken cancellationToken)
    {
        await RequireDefinitionsReadAsync(subject, campaignId, cancellationToken);
        var template = await RequireTemplateAsync(campaignId, templateId, cancellationToken);
        return ToDto(template);
    }

    public async Task<TemplateMetadataDto> RenameTemplateAsync(Subject? subject, int campaignId, Guid templateId, TemplateRenameRequest request, CancellationToken cancellationToken)
    {
        await RequireAdminAsync(subject, campaignId, cancellationToken);
        RequireName(request.Name);
        var expected = RequireRevision(request.ExpectedRevision);
        var template = await RequireTemplateAsync(campaignId, templateId, cancellationToken);
        if (!await resources.RenameTemplateAsync(campaignId, templateId, request.Name!, expected, cancellationToken))
        {
            if (await resources.GetTemplateAsync(campaignId, templateId, cancellationToken) is null)
                throw NotFound();
            throw RevisionConflict(templateId);
        }
        return new TemplateMetadataDto(template.Id, template.Id.ToString("N"), template.CampaignId, request.Name!, expected + 1);
    }

    public async Task<TemplateContentEnvelope> GetTemplateContentAsync(Subject? subject, int campaignId, Guid templateId, CancellationToken cancellationToken)
    {
        await RequireDefinitionsReadAsync(subject, campaignId, cancellationToken);
        await RequireTemplateAsync(campaignId, templateId, cancellationToken);
        var envelope = await content.GetAsync<TemplateContent>(TemplateCollection, campaignId, templateId, cancellationToken);
        if (envelope is null)
            throw ContentMissing(templateId);
        return new TemplateContentEnvelope(envelope.CampaignId, envelope.ResourceId, envelope.ContentRevision, envelope.Data);
    }

    public async Task<TemplateContentEnvelope> UpdateTemplateContentAsync(Subject? subject, int campaignId, Guid templateId, TemplateContentUpdateRequest request, CancellationToken cancellationToken)
    {
        await RequireAdminAsync(subject, campaignId, cancellationToken);
        var expected = RequireRevision(request.ExpectedRevision);
        if (request.Description is null || request.BaseFields is null)
            throw BadRequest("invalid_template", "description and baseFields are required.");
        await RequireTemplateAsync(campaignId, templateId, cancellationToken);
        var current = await content.GetAsync<TemplateContent>(TemplateCollection, campaignId, templateId, cancellationToken)
            ?? throw ContentMissing(templateId);
        if (current.ContentRevision != expected)
            throw RevisionConflict(templateId, "content_revision_conflict");
        var updated = current.Data with { Description = request.Description, BaseFields = BuildFields(request.BaseFields, current.Data.BaseFields) };
        var result = await content.ReplaceAsync(TemplateCollection, campaignId, templateId, expected, updated, cancellationToken);
        if (result is null)
            throw RevisionConflict(templateId, "content_revision_conflict");
        return new TemplateContentEnvelope(result.CampaignId, result.ResourceId, result.ContentRevision, result.Data);
    }

    public async Task<IReadOnlyList<CharacterMetadataDto>> ListCharactersAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        var access = await campaignService.GetAccessAsync(subject, campaignId, cancellationToken);
        var characters = access.IsAdmin
            ? await resources.ListCharactersAsync(campaignId, cancellationToken)
            : await resources.ListCharactersForUserAsync(campaignId, access.Subject.Id, cancellationToken);
        return characters.Select(ToDto).ToArray();
    }

    public async Task<CharacterMetadataDto> CreateCharacterAsync(Subject? subject, int campaignId, CharacterCreateRequest request, CancellationToken cancellationToken)
    {
        await RequireAdminAsync(subject, campaignId, cancellationToken);
        RequireName(request.Name);
        var requestId = RequireRequestId(request.RequestId);
        if (await resources.GetCharacterAsync(campaignId, requestId, cancellationToken) is not null)
            throw AlreadyPublished(requestId);
        if (request.TemplateId is null || request.TemplateId == Guid.Empty)
            throw BadRequest("invalid_template", "A non-empty templateId is required.");
        var importance = request.Importance ?? ParseDefaultImportance();
        RequireImportance(importance);
        if (await resources.GetTemplateAsync(campaignId, request.TemplateId.Value, cancellationToken) is null)
            throw BadRequest("invalid_template", "templateId must identify a template in this campaign.");
        var emptySheet = new CharacterSheet(string.Empty, []);
        try
        {
            await content.CreateAsync(CharacterCollection, campaignId, requestId, emptySheet, cancellationToken);
        }
        catch (ContentAlreadyPreparedException)
        {
            throw new DomainException(409, "content_already_prepared", "Content for this resource is already prepared.", requestId, requestId);
        }

        var metadata = new CharacterMetadata
        {
            Id = requestId,
            CampaignId = campaignId,
            TemplateId = request.TemplateId.Value,
            Name = request.Name!,
            Importance = importance
        };
        try
        {
            return ToDto(await resources.CreateCharacterAsync(metadata, cancellationToken));
        }
        catch (DuplicateResourceException)
        {
            throw AlreadyPublished(requestId);
        }
        catch (Exception exception) when (IsSqlWriteFailure(exception))
        {
            throw PublicationOutcomeUnknown(requestId);
        }
    }

    public async Task<CharacterMetadataDto> GetCharacterAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var (character, _) = await RequireCharacterAccessAsync(subject, campaignId, characterId, false, cancellationToken);
        return ToDto(character);
    }

    public async Task<ResourcePermissionsDto> GetCharacterPermissionsAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var result = await ResolveCharacterAccessAsync(subject, campaignId, characterId, cancellationToken);
        return new ResourcePermissionsDto(true, result.CanWrite, result.Access.IsAdmin);
    }

    public async Task<CharacterMetadataDto> UpdateCharacterAsync(Subject? subject, int campaignId, Guid characterId, CharacterUpdateRequest request, CancellationToken cancellationToken)
    {
        var expected = RequireRevision(request.ExpectedRevision);
        RequireName(request.Name);
        if (request.Importance is null)
            throw BadRequest("invalid_importance", "importance is required.");
        RequireImportance(request.Importance.Value);
        var (character, _) = await RequireCharacterAccessAsync(subject, campaignId, characterId, true, cancellationToken);
        if (!await resources.UpdateCharacterAsync(campaignId, characterId, request.Name!, request.Importance.Value, expected, cancellationToken))
        {
            if (await resources.GetCharacterAsync(campaignId, characterId, cancellationToken) is null)
                throw NotFound();
            throw RevisionConflict(characterId);
        }
        return new CharacterMetadataDto(character.Id, character.CampaignId, character.TemplateId, request.Name!, request.Importance.Value, expected + 1);
    }

    public async Task<CharacterSheetEnvelope> GetCharacterSheetAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var (character, _) = await RequireCharacterAccessAsync(subject, campaignId, characterId, false, cancellationToken);
        return await ReadEffectiveSheetAsync(campaignId, character, cancellationToken);
    }

    public async Task<ContentRevisionDto> UpdateCharacterDescriptionAsync(Subject? subject, int campaignId, Guid characterId, CharacterDescriptionRequest request, CancellationToken cancellationToken)
    {
        var expected = RequireRevision(request.ExpectedRevision);
        if (request.Description is null)
            throw BadRequest("invalid_description", "description is required.");
        await RequireCharacterAccessAsync(subject, campaignId, characterId, true, cancellationToken);
        var current = await GetCharacterDocumentAsync(campaignId, characterId, cancellationToken);
        if (current.ContentRevision != expected)
            throw RevisionConflict(characterId, "content_revision_conflict");
        var updated = current.Data with { Description = request.Description };
        var result = await content.ReplaceAsync(CharacterCollection, campaignId, characterId, expected, updated, cancellationToken);
        if (result is null)
            throw RevisionConflict(characterId, "content_revision_conflict");
        return new ContentRevisionDto(result.ContentRevision);
    }

    public async Task<CharacterSheetEnvelope> SetBaseValueAsync(Subject? subject, int campaignId, Guid characterId, Guid fieldId, BaseValueRequest request, CancellationToken cancellationToken)
    {
        var expected = RequireRevision(request.ExpectedRevision);
        var (character, _) = await RequireCharacterAccessAsync(subject, campaignId, characterId, true, cancellationToken);
        var template = await GetTemplateDocumentAsync(campaignId, character.TemplateId, cancellationToken);
        var field = template.Data.BaseFields.SingleOrDefault(x => x.Id == fieldId) ?? throw NotFound();
        var current = await GetCharacterDocumentAsync(campaignId, characterId, cancellationToken);
        if (current.ContentRevision != expected)
            throw RevisionConflict(characterId, "content_revision_conflict");
        if (request.Value.ValueKind == JsonValueKind.Undefined)
            throw BadRequest("invalid_value", "value is required.");
        ValidateValue(field.ValueType, request.Value, field.Options);
        var value = new SavedBaseValue(field.Id, field.TypeRevision, field.ValueType, request.Value.Clone());
        var baseValues = current.Data.BaseValues.Where(x => x.BaseFieldId != fieldId).Append(value).ToArray();
        var result = await content.ReplaceAsync(CharacterCollection, campaignId, characterId, expected, current.Data with { BaseValues = baseValues }, cancellationToken);
        if (result is null)
            throw RevisionConflict(characterId, "content_revision_conflict");
        return await BuildEffectiveSheetAsync(campaignId, character, result, cancellationToken);
    }

    public async Task<CharacterSheetEnvelope> DeleteBaseValueAsync(Subject? subject, int campaignId, Guid characterId, Guid fieldId, long expectedRevision, CancellationToken cancellationToken)
    {
        var expected = RequireRevision(expectedRevision);
        var (character, _) = await RequireCharacterAccessAsync(subject, campaignId, characterId, true, cancellationToken);
        var template = await GetTemplateDocumentAsync(campaignId, character.TemplateId, cancellationToken);
        if (template.Data.BaseFields.All(x => x.Id != fieldId))
            throw NotFound();
        var current = await GetCharacterDocumentAsync(campaignId, characterId, cancellationToken);
        if (current.ContentRevision != expected)
            throw RevisionConflict(characterId, "content_revision_conflict");
        if (!current.Data.BaseValues.Any(x => x.BaseFieldId == fieldId))
            return await BuildEffectiveSheetAsync(campaignId, character, current, cancellationToken);
        var updated = current.Data with { BaseValues = current.Data.BaseValues.Where(x => x.BaseFieldId != fieldId).ToArray() };
        var result = await content.ReplaceAsync(CharacterCollection, campaignId, characterId, expected, updated, cancellationToken);
        if (result is null)
            throw RevisionConflict(characterId, "content_revision_conflict");
        return await BuildEffectiveSheetAsync(campaignId, character, result, cancellationToken);
    }

    public async Task<IReadOnlyList<CharacterAssignmentDto>> ListAssignmentsAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        await RequireAdminAsync(subject, campaignId, cancellationToken);
        await RequireCharacterAsync(campaignId, characterId, cancellationToken);
        return (await resources.ListAssignmentsAsync(campaignId, characterId, cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task<(CharacterAssignmentDto Assignment, bool Created)> UpsertAssignmentAsync(Subject? subject, int campaignId, Guid characterId, int userId, AssignmentRequest request, CancellationToken cancellationToken)
    {
        await RequireAdminAsync(subject, campaignId, cancellationToken);
        await RequireCharacterAsync(campaignId, characterId, cancellationToken);
        if (!await resources.IsCampaignMemberAsync(campaignId, userId, cancellationToken))
            throw NotFound();
        if (request.CanWrite is null || request.ExpectedRevision is null || request.ExpectedRevision < 0)
            throw BadRequest("invalid_assignment", "canWrite and expectedRevision are required; expectedRevision must be nonnegative.");
        var result = await resources.UpsertAssignmentAsync(campaignId, characterId, userId, request.CanWrite.Value, request.ExpectedRevision.Value, cancellationToken);
        if (result.Revision is null)
        {
            if (request.ExpectedRevision.Value > 0 && !result.Exists)
                throw NotFound();
            throw new DomainException(409, request.ExpectedRevision.Value == 0 ? "assignment_already_exists" : "revision_conflict", "The assignment revision no longer matches.", characterId);
        }
        return (new CharacterAssignmentDto(campaignId, characterId, userId, request.CanWrite.Value, result.Revision.Value), request.ExpectedRevision.Value == 0);
    }

    public async Task DeleteAssignmentAsync(Subject? subject, int campaignId, Guid characterId, int userId, long expectedRevision, CancellationToken cancellationToken)
    {
        await RequireAdminAsync(subject, campaignId, cancellationToken);
        await RequireCharacterAsync(campaignId, characterId, cancellationToken);
        var expected = RequireRevision(expectedRevision);
        if (!await resources.DeleteAssignmentAsync(campaignId, characterId, userId, expected, cancellationToken))
        {
            if (await resources.GetAssignmentAsync(campaignId, characterId, userId, cancellationToken) is null)
                throw NotFound();
            throw RevisionConflict(characterId);
        }
    }

    private async Task RequireDefinitionsReadAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        var access = await campaignService.GetAccessAsync(subject, campaignId, cancellationToken);
        if (!access.IsAdmin && !options.Value.MembersCanReadDefinitions)
            throw Forbidden();
    }

    public async Task EnsureDefinitionsReadAsync(Subject? subject, int campaignId, CancellationToken cancellationToken) =>
        await RequireDefinitionsReadAsync(subject, campaignId, cancellationToken);

    public async Task EnsureAdminAsync(Subject? subject, int campaignId, CancellationToken cancellationToken) =>
        await RequireAdminAsync(subject, campaignId, cancellationToken);

    public async Task<CharacterMetadata> EnsureCharacterAccessAsync(Subject? subject, int campaignId, Guid characterId, bool write, CancellationToken cancellationToken) =>
        (await RequireCharacterAccessAsync(subject, campaignId, characterId, write, cancellationToken)).Character;

    public async Task<CalculationInputs> GetCalculationInputsAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var character = await EnsureCharacterAccessAsync(subject, campaignId, characterId, false, cancellationToken);
        var template = await GetTemplateDocumentAsync(campaignId, character.TemplateId, cancellationToken);
        var sheet = await GetCharacterDocumentAsync(campaignId, characterId, cancellationToken);
        return new CalculationInputs(character, template, sheet, ResolveEffectiveBaseValues(template.Data, sheet.Data));
    }

    private async Task RequireAdminAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        var access = await campaignService.GetAccessAsync(subject, campaignId, cancellationToken);
        if (!access.IsAdmin)
            throw Forbidden();
    }

    private async Task<(CharacterMetadata Character, CampaignAccess Access)> RequireCharacterAccessAsync(Subject? subject, int campaignId, Guid characterId, bool write, CancellationToken cancellationToken)
    {
        var result = await ResolveCharacterAccessAsync(subject, campaignId, characterId, cancellationToken);
        if (write && !result.CanWrite)
            throw Forbidden();
        return (result.Character, result.Access);
    }

    private async Task<(CharacterMetadata Character, CampaignAccess Access, bool CanWrite)> ResolveCharacterAccessAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var access = await campaignService.GetAccessAsync(subject, campaignId, cancellationToken);
        var character = await RequireCharacterAsync(campaignId, characterId, cancellationToken);
        if (access.IsAdmin)
            return (character, access, true);
        var assignment = await resources.GetAssignmentAsync(campaignId, characterId, access.Subject.Id, cancellationToken);
        if (assignment is null)
            throw Forbidden();
        return (character, access, assignment.CanWrite);
    }

    private async Task<CharacterMetadata> RequireCharacterAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        await resources.GetCharacterAsync(campaignId, characterId, cancellationToken) ?? throw NotFound();

    private async Task<TemplateMetadata> RequireTemplateAsync(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        await resources.GetTemplateAsync(campaignId, templateId, cancellationToken) ?? throw NotFound();

    private async Task<ContentEnvelope<CharacterSheet>> GetCharacterDocumentAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        await content.GetAsync<CharacterSheet>(CharacterCollection, campaignId, characterId, cancellationToken) ?? throw ContentMissing(characterId);

    private async Task<ContentEnvelope<TemplateContent>> GetTemplateDocumentAsync(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        await content.GetAsync<TemplateContent>(TemplateCollection, campaignId, templateId, cancellationToken) ?? throw ContentMissing(templateId);

    private async Task<CharacterSheetEnvelope> ReadEffectiveSheetAsync(int campaignId, CharacterMetadata character, CancellationToken cancellationToken)
    {
        var sheet = await GetCharacterDocumentAsync(campaignId, character.Id, cancellationToken);
        return await BuildEffectiveSheetAsync(campaignId, character, sheet, cancellationToken);
    }

    private async Task<CharacterSheetEnvelope> BuildEffectiveSheetAsync(int campaignId, CharacterMetadata character, ContentEnvelope<CharacterSheet> sheet, CancellationToken cancellationToken)
    {
        var template = await GetTemplateDocumentAsync(campaignId, character.TemplateId, cancellationToken);
        var fields = ResolveEffectiveBaseValues(template.Data, sheet.Data);
        return new CharacterSheetEnvelope(sheet.ContentRevision, template.ContentRevision, sheet.Data.Description, fields);
    }

    private static EffectiveBaseField[] ResolveEffectiveBaseValues(TemplateContent template, CharacterSheet sheet) =>
        template.BaseFields.Select(field =>
        {
            var saved = sheet.BaseValues.SingleOrDefault(value => value.BaseFieldId == field.Id);
            var explicitValue = saved is not null && saved.TypeRevision == field.TypeRevision && saved.ValueType == field.ValueType && IsValueCompatible(field.ValueType, saved.Value, field.Options);
            return new EffectiveBaseField(
                field.Id,
                field.Key,
                field.Title,
                field.Description,
                field.ValueType,
                field.TypeRevision,
                field.Options,
                (explicitValue ? saved!.Value : field.Value).Clone(),
                explicitValue);
        }).ToArray();

    private static BaseField[] BuildFields(BaseFieldInput[] inputs, BaseField[] previous)
    {
        var oldById = previous.ToDictionary(x => x.Id);
        var ids = new HashSet<Guid>();
        var keys = new HashSet<string>(StringComparer.Ordinal);
        var result = new BaseField[inputs.Length];
        for (var index = 0; index < inputs.Length; index++)
        {
            var input = inputs[index];
            if (input is null)
                throw BadRequest("invalid_field", "Base field entries cannot be null.");
            if (string.IsNullOrWhiteSpace(input.Key) || input.Title is null || input.Description is null || input.ValueType is null || input.Value.ValueKind == JsonValueKind.Undefined || input.Options is null)
                throw BadRequest("invalid_field", "Base field key, title, description, valueType, value, and options are required.");
            if (!Enum.IsDefined(input.ValueType.Value))
                throw BadRequest("invalid_value_type", "valueType is unknown.");
            if (!keys.Add(input.Key))
                throw BadRequest("duplicate_field_key", "Base field keys must be unique within the template.");
            var type = input.ValueType.Value;
            var options = ValidateOptions(type, input.Options);
            var id = input.Id ?? Guid.NewGuid();
            if (input.Id is null)
            {
                while (oldById.ContainsKey(id) || ids.Contains(id))
                    id = Guid.NewGuid();
            }
            if (!ids.Add(id))
                throw BadRequest("duplicate_field_id", "Base field IDs must be unique.");
            long typeRevision;
            if (input.Id is null)
            {
                typeRevision = 1;
            }
            else
            {
                if (!oldById.TryGetValue(id, out var oldField))
                    throw BadRequest("unknown_field", "The field ID is not active in this template.");
                if (!string.Equals(input.Key, oldField.Key, StringComparison.Ordinal))
                    throw BadRequest("field_key_immutable", "An existing field key cannot be changed.");
                typeRevision = oldField.TypeRevision + (oldField.ValueType == type ? 0 : 1);
            }
            var value = input.Value;
            ValidateValue(type, value, options);
            result[index] = new BaseField(id, input.Key, input.Title, input.Description, type, typeRevision, value.Clone(), options);
        }
        return result;
    }

    private static ChoiceOption[] ValidateOptions(ValueType type, ChoiceOption[] options)
    {
        if (type is not (ValueType.SingleChoice or ValueType.MultiChoice) && options.Length != 0)
            throw BadRequest("invalid_options", "Options are only valid for choice fields.");
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var option in options)
        {
            if (option is null || string.IsNullOrWhiteSpace(option.OptionKey) || option.Title is null || !keys.Add(option.OptionKey))
                throw BadRequest("invalid_options", "Choice options must have unique non-whitespace optionKey values and a title.");
        }
        return options.ToArray();
    }

    private static void ValidateValue(ValueType type, JsonElement value, ChoiceOption[] options)
    {
        if (!IsValueCompatible(type, value, options))
            throw BadRequest("invalid_value", "The value is incompatible with the field type or current options.");
    }

    private static bool IsValueCompatible(ValueType type, JsonElement value, ChoiceOption[] options)
    {
        try
        {
            switch (type)
            {
                case ValueType.Integer:
                    if (value.ValueKind != JsonValueKind.Number)
                        return false;
                    if (value.TryGetInt64(out _))
                        return true;
                    return value.TryGetDecimal(out var decimalValue) && decimal.Truncate(decimalValue) == decimalValue && decimalValue >= long.MinValue && decimalValue <= long.MaxValue;
                case ValueType.Number:
                    return value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number);
                case ValueType.String:
                    return value.ValueKind == JsonValueKind.String;
                case ValueType.Boolean:
                    return value.ValueKind is JsonValueKind.True or JsonValueKind.False;
                case ValueType.SingleChoice:
                    return value.ValueKind == JsonValueKind.String && options.Any(x => x.OptionKey == value.GetString());
                case ValueType.MultiChoice:
                    if (value.ValueKind != JsonValueKind.Array)
                        return false;
                    var allowed = options.Select(x => x.OptionKey).ToHashSet(StringComparer.Ordinal);
                    var selected = new HashSet<string>(StringComparer.Ordinal);
                    foreach (var item in value.EnumerateArray())
                    {
                        if (item.ValueKind != JsonValueKind.String || item.GetString() is not { } key || !allowed.Contains(key) || !selected.Add(key))
                            return false;
                    }
                    return true;
                default:
                    return false;
            }
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    private Importance ParseDefaultImportance()
    {
        if (!Enum.TryParse<Importance>(options.Value.DefaultImportance, true, out var value) || !Enum.IsDefined(value))
            throw new InvalidOperationException("Characters:DefaultImportance was not validated.");
        return value;
    }

    private static void RequireImportance(Importance value)
    {
        if (!Enum.IsDefined(value))
            throw BadRequest("invalid_importance", "importance is unknown.");
    }

    private static void RequireName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw BadRequest("invalid_name", "A non-whitespace name is required.");
    }

    private static Guid RequireRequestId(Guid? requestId)
    {
        if (requestId is null || requestId == Guid.Empty)
            throw BadRequest("invalid_request_id", "A non-empty requestId is required.");
        return requestId.Value;
    }

    private static long RequireRevision(long? revision)
    {
        if (revision is null || revision < 1)
            throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        return revision.Value;
    }

    private static TemplateMetadataDto ToDto(TemplateMetadata template) => new(template.Id, template.Id.ToString("N"), template.CampaignId, template.Name, template.MetadataRevision);
    private static CharacterMetadataDto ToDto(CharacterMetadata character) => new(character.Id, character.CampaignId, character.TemplateId, character.Name, character.Importance, character.MetadataRevision);
    private static CharacterAssignmentDto ToDto(CharacterAssignment assignment) => new(assignment.CampaignId, assignment.CharacterId, assignment.UserId, assignment.CanWrite, assignment.MetadataRevision);
    private static DomainException Forbidden() => new(403, "forbidden", "The operation is not permitted.");
    private static DomainException NotFound() => new(404, "not_found", "The requested resource was not found.");
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException AlreadyPublished(Guid id) => new(409, "already_published", "The resource has already been published.", id, id);
    private static DomainException RevisionConflict(Guid id, string code = "revision_conflict") => new(409, code, "The resource revision no longer matches.", id);
    private static DomainException ContentMissing(Guid id) => new(503, "content_unavailable", "The content store does not contain the published resource.", id);
    private static DomainException PublicationOutcomeUnknown(Guid id) => new(503, "publication_outcome_unknown", "The metadata publication outcome could not be confirmed.", id, id);
    private static bool IsSqlWriteFailure(Exception exception) => exception is DbUpdateException or DbException or CampaignStoreException;
}
