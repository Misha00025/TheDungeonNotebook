using System.ComponentModel.DataAnnotations;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Computation;

public enum NumericResultType
{
    Integer,
    Number
}

public enum FieldSourceKind
{
    Base,
    Virtual
}

public sealed record FieldReference([property: System.Text.Json.Serialization.JsonRequired] FieldSourceKind Kind, Guid FieldId);

public sealed record VirtualField(
    Guid Id,
    string Key,
    string Title,
    string Description,
    NumericResultType ResultType,
    Guid FormulaId,
    Dictionary<string, FieldReference> Bindings);

public sealed record FormulaContent(string Expression, string[] Parameters);
public sealed record VirtualFormulaOverride(Guid VirtualFieldId, string Expression);
public sealed record FormulaInput(Guid Id, long ContentRevision, FormulaContent Data);
public sealed record CalculationDiagnostic(string Code, string Message);
public sealed record VirtualResult(Guid Id, string Key, string Title, string Description, NumericResultType ResultType, object? Value, CalculationDiagnostic? Diagnostic);
public sealed record FormulaRevision(Guid Id, long ContentRevision);
public sealed record ComputationResult(IReadOnlyList<VirtualResult> VirtualFields, IReadOnlyList<FormulaRevision> FormulaContentRevisions);
public sealed record FormulaMetadataDto(Guid Id, string Key, int CampaignId, string Name, long MetadataRevision);
public sealed record FormulaCreateRequest
{
    [Required] public Guid? RequestId { get; init; }
    [Required] public string? Name { get; init; }
    [Required] public string? Expression { get; init; }
    [Required] public string[]? Parameters { get; init; }
}
public sealed record FormulaMetadataUpdateRequest
{
    [Required] public string? Name { get; init; }
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
}
public sealed record FormulaContentUpdateRequest
{
    [Required] public string? Expression { get; init; }
    [Required] public string[]? Parameters { get; init; }
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
}
public sealed record FormulaContentEnvelope(int CampaignId, Guid ResourceId, long ContentRevision, FormulaContent Data);
public sealed record FormulaCreateDto(Guid Id, string Key, int CampaignId, string Name, long MetadataRevision, long ContentRevision);
[System.Text.Json.Serialization.JsonUnmappedMemberHandling(System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow)]
public sealed record VirtualFieldInput
{
    public Guid? Id { get; init; }
    [Required] public string? Key { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Title { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Description { get; init; }
    [Required] public NumericResultType? ResultType { get; init; }
    [Required] public Guid? FormulaId { get; init; }
    [Required] public Dictionary<string, FieldReference>? Bindings { get; init; }
}
public sealed record VirtualFieldsUpdateRequest
{
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public VirtualFieldInput[]? VirtualFields { get; init; }
}
public sealed record TemplateVirtualFieldsUpdateRequest
{
    [Required, Range(0, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public VirtualFieldInput[]? VirtualFields { get; init; }
}
public sealed record VirtualFieldsEnvelope(long ContentRevision, IReadOnlyList<VirtualField> VirtualFields);
public sealed record OverrideInput
{
    [Required] public string? Expression { get; init; }
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
}
public sealed record OverridesEnvelope(long ContentRevision, IReadOnlyList<VirtualFormulaOverride> Overrides);
public sealed record ComputedSheetResponse(
    long ContentRevision,
    long TemplateContentRevision,
    IReadOnlyList<FormulaRevision> FormulaContentRevisions,
    string Description,
    IReadOnlyList<EffectiveBaseField> BaseFields,
    IReadOnlyList<VirtualResult> VirtualFields);
public sealed record CalculationInputs(
    CharacterMetadata Character,
    ContentEnvelope<TemplateContent> Template,
    ContentEnvelope<CharacterSheet> Sheet,
    IReadOnlyList<EffectiveBaseField> BaseFields);
