namespace Tdn.Models.Groups.Conversion;

public static class GroupSchemaConversion
{
    
    public static FilterPreset AsModel(this FilterPresetPostData data) => new()
    {
        Name = data.Name,
        Filters = data.Filters.Select(e => (e.Key, e.Value)).ToList()  
    };
    
    public static Schema AsSchema(this SchemaPostData data, string type)
    {
        var schema = new Schema() {Type = type};
        schema.FilterPresets = data.FilterPresets?.Select(e => e.AsModel()).ToList() ?? new();
        return schema;
    }
    
    public static object ToResponse(this FilterPreset category) => new 
    {
        name = category.Name,
        filters = category.Filters.Select(e => new {key = e.key, value = e.value}).ToList(),
    };
    
    public static object ToResponse(this Schema schema) => new
    {
        type = schema.Type,
        filterPresets = schema.FilterPresets.Select(e => e.ToResponse()).ToList()
    };
}