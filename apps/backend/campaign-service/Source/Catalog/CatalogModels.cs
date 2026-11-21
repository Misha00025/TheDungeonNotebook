using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public enum CatalogKind { Item, Skill }
public enum QuantityUnit { Whole, Fractional, Single }
public enum AttributeEditLevel { Definition, Character }

public sealed class CatalogEntry
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Tdn.Campaigns.Campaigns.Campaign Campaign { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public CatalogKind Kind { get; set; }
    public int? CreatorUserId { get; set; }
    public bool IsHidden { get; set; }
    public QuantityUnit? QuantityUnit { get; set; }
    public bool AllowNegative { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed record CatalogEntryDto(Guid Id, int CampaignId, string Name, CatalogKind Kind, int? CreatorUserId, bool IsHidden, QuantityUnit? QuantityUnit, bool AllowNegative, long MetadataRevision);
public sealed record CatalogAttributeDefinition(Guid Id, string Title, string TypeKey, long TypeRevision, ChoiceOption[] Options, bool IsActive);
public sealed record CatalogAttributeSchema(CatalogAttributeDefinition[] Definitions);
public sealed record CatalogAttributeSchemaEnvelope(int CampaignId, long ContentRevision, CatalogAttributeSchema Data);
public sealed record CatalogAttributeValue(
    [property: JsonRequired] Guid Id,
    [property: JsonRequired] Guid AttributeId,
    [property: JsonRequired] string TypeKey,
    [property: JsonRequired] long TypeRevision,
    [property: JsonRequired] JsonElement Value,
    [property: JsonRequired] AttributeEditLevel EditLevel);
public sealed record CatalogContent(string Description, CatalogAttributeValue[] Attributes);
public sealed record CatalogDiagnostic(Guid OccurrenceId, string Code);
public sealed record CatalogContentEnvelope(int CampaignId, Guid ResourceId, long ContentRevision, long AttributeSchemaRevision, CatalogContent Data, CatalogDiagnostic[] Diagnostics);
public sealed record CatalogCreateResult(CatalogEntryDto Entry, CatalogContentEnvelope Content);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogCreateRequest
{
    [Required] public Guid? RequestId { get; init; }
    [Required] public string? Name { get; init; }
    [Required] public CatalogKind? Kind { get; init; }
    [Required] public bool? IsHidden { get; init; }
    public QuantityUnit? QuantityUnit { get; init; }
    [Required] public bool? AllowNegative { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Description { get; init; }
    [Required] public CatalogAttributeValue[]? Attributes { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogMetadataUpdateRequest
{
    [Required] public string? Name { get; init; }
    public bool? IsHidden { get; init; }
    public QuantityUnit? QuantityUnit { get; init; }
    public bool? AllowNegative { get; init; }
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogContentUpdateRequest
{
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Description { get; init; }
    [Required] public CatalogAttributeValue[]? Attributes { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogAttributesUpdateRequest
{
    [Required, Range(0, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public CatalogAttributeDefinitionInput[]? Definitions { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogAttributeDefinitionInput
{
    public Guid? Id { get; init; }
    [Required] public string? Title { get; init; }
    [Required] public string? TypeKey { get; init; }
    [Required] public ChoiceOption[]? Options { get; init; }
    [Required] public bool? IsActive { get; init; }
}
