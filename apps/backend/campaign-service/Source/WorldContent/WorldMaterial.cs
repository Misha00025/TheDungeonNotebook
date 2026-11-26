using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Tdn.Campaigns.WorldContent;

public sealed class WorldMaterial
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Tdn.Campaigns.Campaigns.Campaign Campaign { get; set; } = null!;
    public string Kind { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tags { get; set; } = "[]";
    public bool IsPublished { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed record WorldMaterialDto(Guid Id, int CampaignId, string Kind, string Title, string Description, string[] Tags, bool IsPublished, long MetadataRevision);
public sealed record WorldMaterialBodyDto(string Body, string BodyVersion);
public sealed record WorldMaterialCreatedDto(WorldMaterialDto Material, string BodyVersion);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class WorldMaterialCreateRequest
{
    [Required] public Guid? RequestId { get; init; }
    [Required] public string? Title { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Description { get; init; }
    [Required] public string[]? Tags { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Body { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class WorldMaterialUpdateRequest
{
    [Required] public string? Title { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Description { get; init; }
    [Required] public string[]? Tags { get; init; }
    [Required] public bool? IsPublished { get; init; }
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class WorldMaterialBodyUpdateRequest
{
    [Required(AllowEmptyStrings = true)] public string? Body { get; init; }
    [Required] public string? ExpectedVersion { get; init; }
}
