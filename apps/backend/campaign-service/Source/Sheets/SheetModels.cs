using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tdn.Campaigns.Sheets;

public enum Importance
{
    Background,
    Secondary,
    Key
}

public enum ValueType
{
    Integer,
    Number,
    String,
    Boolean,
    SingleChoice,
    MultiChoice
}

public sealed record TemplateMetadataDto(int CampaignId, string Name, long MetadataRevision);
public sealed record TemplateContentEnvelope(int CampaignId, long ContentRevision, TemplateContent Data);
public sealed record CharacterMetadataDto(Guid Id, int CampaignId, string Name, Importance Importance, long MetadataRevision);
public sealed record CharacterAssignmentDto(int CampaignId, Guid CharacterId, int UserId, bool CanWrite, long MetadataRevision);
public sealed record ContentRevisionDto(long ContentRevision);
public sealed record CharacterSheetEnvelope(long ContentRevision, long TemplateContentRevision, string Description, IReadOnlyList<EffectiveBaseField> BaseFields);
public sealed record EffectiveBaseField(Guid Id, string Key, string Title, string Description, ValueType ValueType, long TypeRevision, ChoiceOption[] Options, JsonElement EffectiveValue, bool IsExplicit);
public sealed record ContentEnvelope<T>(int CampaignId, Guid ResourceId, long ContentRevision, T Data);

public sealed record ChoiceOption(string OptionKey, string Title);
public sealed record BaseField(Guid Id, string Key, string Title, string Description, ValueType ValueType, long TypeRevision, JsonElement Value, ChoiceOption[] Options);
public sealed record TemplateContent(string Description, BaseField[] BaseFields)
{
    public Tdn.Campaigns.Computation.VirtualField[] VirtualFields { get; init; } = [];
}
public sealed record SavedBaseValue(Guid BaseFieldId, long TypeRevision, ValueType ValueType, JsonElement Value);
public sealed record CharacterSheet(string Description, SavedBaseValue[] BaseValues)
{
    public Tdn.Campaigns.Computation.VirtualFormulaOverride[] VirtualFormulaOverrides { get; init; } = [];
    public Tdn.Campaigns.Computation.VirtualField[] CustomVirtualFields { get; init; } = [];
}

public sealed class BaseFieldInput
{
    public Guid? Id { get; init; }
    [Required]
    public string? Key { get; init; }
    [Required(AllowEmptyStrings = true)]
    public string? Title { get; init; }
    [Required(AllowEmptyStrings = true)]
    public string? Description { get; init; }
    [Required]
    public ValueType? ValueType { get; init; }
    [Required]
    public JsonElement Value { get; init; }
    [Required]
    public ChoiceOption[]? Options { get; init; }
}

public sealed class TemplateRenameRequest
{
    [Required]
    public string? Name { get; init; }
    [Required]
    [Range(1, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
}

public sealed class TemplateContentUpdateRequest
{
    [Required]
    [Range(0, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
    [Required(AllowEmptyStrings = true)]
    public string? Description { get; init; }
    [Required]
    public BaseFieldInput[]? BaseFields { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CharacterCreateRequest
{
    [Required]
    public Guid? RequestId { get; init; }
    [Required]
    public string? Name { get; init; }
    public Importance? Importance { get; init; }
}

public sealed class CharacterUpdateRequest
{
    [Required]
    public string? Name { get; init; }
    [Required]
    public Importance? Importance { get; init; }
    [Required]
    [Range(1, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
}

public sealed class CharacterDescriptionRequest
{
    [Required(AllowEmptyStrings = true)]
    public string? Description { get; init; }
    [Required]
    [Range(1, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
}

public sealed class BaseValueRequest
{
    [Required]
    public JsonElement Value { get; init; }
    [Required]
    [Range(1, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
}

public sealed class AssignmentRequest
{
    [Required]
    public bool? CanWrite { get; init; }
    [Required]
    [Range(0, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
}
