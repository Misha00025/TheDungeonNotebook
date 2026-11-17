using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;
using Tdn.Campaigns.Computation;

namespace Tdn.Campaigns.Views;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(LayoutNode), "layout")]
[JsonDerivedType(typeof(WidgetNode), "widget")]
public abstract record ViewNode(string NodeKey, string Title, JsonElement Params, ViewNode[] Children);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record LayoutNode(string NodeKey, string Title, JsonElement Params, ViewNode[] Children)
    : ViewNode(NodeKey, Title, Params, Children);

public sealed record WidgetNode(string NodeKey, string Title, JsonElement Params, ViewNode[] Children,
    WidgetSource[] Sources, string Format)
    : ViewNode(NodeKey, Title, Params, Children);

public sealed record WidgetSource(Guid TemplateId, [property: JsonRequired] FieldSourceKind Kind, Guid FieldId);
public sealed record ViewContent(ViewNode[] Roots);
public sealed record ViewContentEnvelope(int CampaignId, Guid ResourceId, long ContentRevision, ViewContent Data);
public sealed record ViewMetadataDto(Guid Id, string Key, int CampaignId, string Name, long MetadataRevision);
public sealed record ViewCreateDto(Guid Id, string Key, int CampaignId, string Name, long MetadataRevision, long ContentRevision);

public sealed class ViewCreateRequest
{
    [Required] public Guid? RequestId { get; init; }
    [Required] public string? Name { get; init; }
    [Required] public ViewNode[]? Roots { get; init; }
}

public sealed class ViewMetadataUpdateRequest
{
    [Required] public string? Name { get; init; }
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
}

public sealed class ViewContentUpdateRequest
{
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public ViewNode[]? Roots { get; init; }
}

public sealed record PresentationConfig(Dictionary<string, string> Defaults, Dictionary<string, JsonElement> ContextParams);
public sealed record PresentationEnvelope(long ContentRevision, Dictionary<string, string> Defaults, Dictionary<string, JsonElement> ContextParams);
public sealed record ResolvedPresentationDto(string ContextKey, ViewMetadataDto ViewMetadata, ViewContentEnvelope ViewContent, JsonElement? ContextParams, long ContentRevision);
public sealed record ViewSourceDiagnostic(string Code);
public sealed record ResolvedWidgetSource(int SourceIndex, WidgetSource Source, JsonElement? Value, ViewSourceDiagnostic? Diagnostic);
public sealed record WidgetSourcesProjection(string NodeKey, IReadOnlyList<ResolvedWidgetSource> Sources);
public sealed record ViewSourcesResponse(long ViewContentRevision, long ContentRevision, long TemplateContentRevision,
    IReadOnlyList<FormulaRevision> FormulaContentRevisions, IReadOnlyList<WidgetSourcesProjection> Widgets);

public sealed class PresentationUpdateRequest
{
    [Required, Range(0, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public Dictionary<string, string>? Defaults { get; init; }
    [Required] public Dictionary<string, JsonElement>? ContextParams { get; init; }
}
