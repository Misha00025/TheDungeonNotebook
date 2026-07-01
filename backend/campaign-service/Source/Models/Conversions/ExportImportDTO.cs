using System.Text.Json.Serialization;

namespace Tdn.Models.Conversions;

public static class ExportImportConstants
{
    public const int CurrentVersion = 1;
}

public class ExportData
{
    [JsonPropertyName("version")]
    public int Version { get; set; } = ExportImportConstants.CurrentVersion;

    [JsonPropertyName("exportedAt")]
    public string ExportedAt { get; set; } = DateTime.UtcNow.ToString("o");

    [JsonPropertyName("groupId")]
    public int GroupId { get; set; }

    [JsonPropertyName("templateSchema")]
    public TemplateSchemaExportData? TemplateSchema { get; set; }

    [JsonPropertyName("charlists")]
    public List<CharlistExportData>? Charlists { get; set; }

    [JsonPropertyName("characters")]
    public List<CharacterExportData>? Characters { get; set; }

    [JsonPropertyName("items")]
    public List<ItemExportData>? Items { get; set; }

    [JsonPropertyName("skills")]
    public List<SkillExportData>? Skills { get; set; }

    [JsonPropertyName("skillAttributes")]
    public SkillAttributesExportData? SkillAttributes { get; set; }

    [JsonPropertyName("characterItems")]
    public List<CharacterItemLinkExportData>? CharacterItems { get; set; }

    [JsonPropertyName("characterSkills")]
    public List<CharacterSkillLinkExportData>? CharacterSkills { get; set; }
}

public class TemplateSchemaExportData
{
    [JsonPropertyName("categories")]
    public List<CategorySchemaExportData> Categories { get; set; } = new();
}

public class CategorySchemaExportData
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("fields")]
    public List<string> Fields { get; set; } = new();

    [JsonPropertyName("categories")]
    public List<CategorySchemaExportData>? Categories { get; set; }

    [JsonPropertyName("key")]
    public string Key { get; set; } = "";
}

public class CharlistExportData
{
    [JsonPropertyName("oldId")]
    public int OldId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("fields")]
    public Dictionary<string, FieldExportData> Fields { get; set; } = new();
}

public class FieldExportData
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("value")]
    public int Value { get; set; }

    [JsonPropertyName("maxValue")]
    public int? MaxValue { get; set; }

    [JsonPropertyName("formula")]
    public string? Formula { get; set; }

    [JsonPropertyName("modifierFormula")]
    public string? ModifierFormula { get; set; }
}

public class CharacterExportData
{
    [JsonPropertyName("oldId")]
    public int OldId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("templateOldId")]
    public int? TemplateOldId { get; set; }

    [JsonPropertyName("ownerId")]
    public int? OwnerId { get; set; }

    [JsonPropertyName("fields")]
    public Dictionary<string, FieldExportData> Fields { get; set; } = new();
}

public class ItemExportData
{
    [JsonPropertyName("oldId")]
    public int OldId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("price")]
    public int Price { get; set; }

    [JsonPropertyName("isSecret")]
    public bool IsSecret { get; set; }

    [JsonPropertyName("imageLink")]
    public string? ImageLink { get; set; }

    [JsonPropertyName("attributes")]
    public List<ValuedAttributeExportData> Attributes { get; set; } = new();
}

public class SkillExportData
{
    [JsonPropertyName("oldId")]
    public int OldId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("isSecret")]
    public bool IsSecret { get; set; }

    [JsonPropertyName("attributes")]
    public List<ValuedAttributeExportData> Attributes { get; set; } = new();
}

public class ValuedAttributeExportData
{
    [JsonPropertyName("key")]
    public string Key { get; set; } = "";

    [JsonPropertyName("value")]
    public string Value { get; set; } = "";
}

public class SkillAttributesExportData
{
    [JsonPropertyName("attributes")]
    public List<AttributeDefinitionExportData> Attributes { get; set; } = new();
}

public class AttributeDefinitionExportData
{
    [JsonPropertyName("key")]
    public string Key { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("isFiltered")]
    public bool IsFiltered { get; set; }

    [JsonPropertyName("knownValues")]
    public List<string> KnownValues { get; set; } = new();
}

public class CharacterItemLinkExportData
{
    [JsonPropertyName("characterOldId")]
    public int CharacterOldId { get; set; }

    [JsonPropertyName("itemOldId")]
    public int ItemOldId { get; set; }

    [JsonPropertyName("amount")]
    public int Amount { get; set; }
}

public class CharacterSkillLinkExportData
{
    [JsonPropertyName("characterOldId")]
    public int CharacterOldId { get; set; }

    [JsonPropertyName("skillOldId")]
    public int SkillOldId { get; set; }
}

public class ImportResult
{
    [JsonPropertyName("imported")]
    public Dictionary<string, int> Imported { get; set; } = new();

    [JsonPropertyName("errors")]
    public List<string> Errors { get; set; } = new();

    [JsonPropertyName("success")]
    public bool Success => Errors.Count == 0;
}
