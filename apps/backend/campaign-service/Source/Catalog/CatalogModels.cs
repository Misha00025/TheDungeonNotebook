using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Catalog;

public interface ICatalogType
{
    static abstract string DefinitionsTable { get; }
    static abstract string CharacterEntriesTable { get; }
    static abstract string AdditionReceiptsTable { get; }
    static abstract string AttributeDefinitionsCollection { get; }
    static abstract string ContentsCollection { get; }
    static abstract string CharacterContentsCollection { get; }
    static abstract string GroupsCollection { get; }
    static abstract bool HasQuantity { get; }
}

public sealed class ItemCatalog : ICatalogType
{
    public static string DefinitionsTable => "ItemDefinitions";
    public static string CharacterEntriesTable => "CharacterItems";
    public static string AdditionReceiptsTable => "ItemAdditionReceipts";
    public static string AttributeDefinitionsCollection => "itemAttributeDefinitions";
    public static string ContentsCollection => "itemContents";
    public static string CharacterContentsCollection => "characterItemContents";
    public static string GroupsCollection => "itemGroups";
    public static bool HasQuantity => true;
}

public sealed class SkillCatalog : ICatalogType
{
    public static string DefinitionsTable => "SkillDefinitions";
    public static string CharacterEntriesTable => "CharacterSkills";
    public static string AdditionReceiptsTable => "SkillAdditionReceipts";
    public static string AttributeDefinitionsCollection => "skillAttributeDefinitions";
    public static string ContentsCollection => "skillContents";
    public static string CharacterContentsCollection => "characterSkillContents";
    public static string GroupsCollection => "skillGroups";
    public static bool HasQuantity => false;
}

public enum QuantityUnit { Whole, Fractional, Single }
public enum AttributeEditLevel { Definition, Character }

public sealed class CatalogEntry<TCatalog> where TCatalog : ICatalogType
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Tdn.Campaigns.Campaigns.Campaign Campaign { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int? CreatorUserId { get; set; }
    public bool IsHidden { get; set; }
    public QuantityUnit? QuantityUnit { get; set; }
    public bool AllowNegative { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed class CharacterCatalogEntry<TCatalog> where TCatalog : ICatalogType
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Guid CharacterId { get; set; }
    public Tdn.Campaigns.Sheets.CharacterMetadata? Character { get; set; }
    public Guid CatalogEntryId { get; set; }
    public CatalogEntry<TCatalog>? CatalogEntry { get; set; }
    public decimal? Quantity { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed class CatalogAdditionReceipt<TCatalog> where TCatalog : ICatalogType
{
    public int CampaignId { get; set; }
    public Guid CharacterId { get; set; }
    public Guid RequestId { get; set; }
    public Guid EntryId { get; set; }
    public Guid CatalogEntryId { get; set; }
}

public record CatalogEntryDto(Guid Id, int CampaignId, string Name, int? CreatorUserId, bool IsHidden, QuantityUnit? QuantityUnit, bool AllowNegative, long MetadataRevision);
public sealed record CatalogAttributeDefinition(Guid Id, string Title, string TypeKey, ChoiceOption[] Options);
public sealed record CatalogAttributeSchema(CatalogAttributeDefinition[] Definitions);
public sealed record CatalogAttributeSchemaEnvelope(int CampaignId, long ContentRevision, CatalogAttributeSchema Data);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CatalogAttributeValue(
    [property: JsonRequired] Guid Id,
    [property: JsonRequired] Guid AttributeId,
    [property: JsonRequired] JsonElement Value,
    [property: JsonRequired] AttributeEditLevel EditLevel);
public sealed record CatalogContent(string Description, CatalogAttributeValue[] Attributes);
public sealed record CatalogContentEnvelope(int CampaignId, Guid ResourceId, long ContentRevision, CatalogContent Data);
public sealed record CatalogCreateResult(CatalogEntryDto Entry, CatalogContentEnvelope Content);
public sealed record CatalogDefinitionPreparation<TCatalog>(CatalogEntry<TCatalog> Entry, CatalogContent Content, CatalogAttributeSchemaEnvelope Schema) where TCatalog : ICatalogType;
public sealed record CharacterCatalogContent(CatalogAttributeValue[] Attributes);
public sealed record CharacterCatalogEntryDto(Guid Id, int CampaignId, Guid CharacterId, Guid CatalogEntryId, decimal? Quantity, long MetadataRevision);
public sealed record CharacterCatalogAdditionDto(int CampaignId, Guid CharacterId, Guid RequestId, Guid EntryId, Guid CatalogEntryId);
public sealed record CharacterCatalogEntryEnvelope(CharacterCatalogEntryDto Record, CatalogEntryDto Definition, string DefinitionDescription, CatalogAttributeValue[] EffectiveAttributes, CatalogAttributeValue[] ExplicitAttributes, long DefinitionContentRevision, long LocalContentRevision);
public sealed record CharacterCatalogAddResponse(Guid RequestId, CharacterCatalogEntryEnvelope Entry);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CharacterCatalogAddRequest
{
    [Required] public Guid? RequestId { get; init; }
    [Required] public Guid? CatalogEntryId { get; init; }
    public decimal? Quantity { get; init; }
    [Required] public CatalogAttributeValue[]? Attributes { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CharacterCatalogCreateRequest
{
    [Required] public Guid? RequestId { get; init; }
    [Required] public CharacterCatalogDefinitionInput? Definition { get; init; }
    public decimal? Quantity { get; init; }
    [Required] public CatalogAttributeValue[]? Attributes { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CharacterCatalogDefinitionInput
{
    [Required] public string? Name { get; init; }
    [Required] public bool? IsHidden { get; init; }
    public QuantityUnit? QuantityUnit { get; init; }
    [Required] public bool? AllowNegative { get; init; }
    [Required(AllowEmptyStrings = true)] public string? Description { get; init; }
    [Required] public CatalogAttributeValue[]? Attributes { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CharacterCatalogQuantityUpdateRequest
{
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public decimal? Quantity { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CharacterCatalogAttributesUpdateRequest
{
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
    [Required] public CatalogAttributeValue[]? Attributes { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogCreateRequest
{
    [Required] public Guid? RequestId { get; init; }
    [Required] public string? Name { get; init; }
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
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CatalogAttributeDeleteRequest
{
    [Required, Range(1, long.MaxValue)] public long? ExpectedRevision { get; init; }
}
