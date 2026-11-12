using Tdn.Db.Entities;

namespace Tdn.Models.Conversions;

public static class SystemToDictExtensions
{
    public static Dictionary<string, object?> ToDict(this SystemData data)
    {
        return new()
        {
            {"id", data.Id},
            {"name", data.Name},
            {"description", data.Description},
            {"icon", data.Icon},
            {"created_at", data.CreatedAt},
            {"updated_at", data.UpdatedAt}
        };
    }

    public static Dictionary<string, object?> ToDict(this SystemVersionData data)
    {
        return new()
        {
            {"id", data.Id},
            {"system_id", data.SystemId},
            {"version", data.Version},
            {"snapshot_id", data.SnapshotId},
            {"created_at", data.CreatedAt}
        };
    }

    public static Dictionary<string, object?> ToDict(this SnapshotData data)
    {
        return new()
        {
            {"id", data.Id.ToString()},
            {"system_id", data.SystemId},
            {"version_id", data.VersionId},
            {"content", data.Content.ToDict()},
            {"created_at", data.CreatedAt}
        };
    }

    public static Dictionary<string, object?> ToDict(this SnapshotContentData data)
    {
        return new()
        {
            {"items", data.Items.Select(e => e.ToDict()).ToList()},
            {"skills", data.Skills.Select(e => e.ToDict()).ToList()},
            {"character_template", data.CharacterTemplate?.ToDict()}
        };
    }

    public static Dictionary<string, object?> ToDict(this SnapshotContentItemData data)
    {
        var result = new Dictionary<string, object?>
        {
            {"id", data.Id},
            {"name", data.Name},
            {"description", data.Description},
            {"properties", data.Properties},
            {"price", data.Price},
            {"rarity", data.Rarity}
        };
        return result;
    }

    public static Dictionary<string, object?> ToDict(this SnapshotCharacterTemplateData data)
    {
        return new()
        {
            {"fields", data.Fields.Select(e => e.ToDict()).ToList()}
        };
    }

    public static Dictionary<string, object?> ToDict(this SnapshotTemplateFieldData data)
    {
        return new()
        {
            {"key", data.Key},
            {"label", data.Label},
            {"type", data.Type},
            {"formula", data.Formula}
        };
    }
}
