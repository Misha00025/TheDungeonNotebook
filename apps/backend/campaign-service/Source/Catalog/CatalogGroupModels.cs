using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tdn.Campaigns.Catalog;

public sealed record CatalogGroupConfiguration(CatalogGroup[] Groups);
public sealed record CatalogGroup(Guid Id, string Title, Guid? ParentId, Guid[] EntryIds, CatalogGroupCondition? Condition);
public sealed record CatalogGroupSummary(Guid Id, string Title, Guid? ParentId);
public sealed record CatalogGroupsEnvelope(int CampaignId, long ContentRevision, CatalogGroupSummary[] Groups);
public sealed record CatalogGroupConfigurationEnvelope(int CampaignId, long ContentRevision, CatalogGroupConfiguration Data, CatalogGroupDiagnostic[] Diagnostics);
public sealed record CatalogGroupEntriesEnvelope(int CampaignId, Guid GroupId, long ConfigurationRevision, CatalogEntryDto[] Entries, CatalogGroupDiagnostic[] Diagnostics);
public sealed record CatalogGroupDiagnostic(Guid GroupId, Guid? EntryId, string Code);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogGroupsUpdateRequest
{
    [Required, Range(0, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public CatalogGroupInput[]? Groups { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogGroupInput
{
    public Guid? Id { get; init; }
    [Required] public string? Title { get; init; }
    public Guid? ParentId { get; init; }
    [Required] public Guid[]? EntryIds { get; init; }
    public CatalogGroupCondition? Condition { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogGroupCondition
{
    public string? Operator { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Guid? AttributeId { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public JsonElement Value { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public CatalogGroupCondition[]? Children { get; init; }
}
