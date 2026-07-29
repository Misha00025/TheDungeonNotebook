using Tdn.Models.DTOs;

namespace Tdn.Models.Schemas.Items.Conversion;

public static class GroupSchemaConversion
{
    
    public static Schema AsSchema(this SchemaPostData data, string type)
    {
        var schema = new Schema() {Type = type, GroupingAttributes = data.GroupBy};
        // schema.FilterPresets = data.FilterPresets?.Select(e => e.AsModel()).ToList() ?? new();
        return schema;
    }
    
    public static object ToResponse(this Schema schema) => new
    {
        type = schema.Type,
        groupBy = schema.GroupingAttributes
        // filterPresets = schema.FilterPresets.Select(e => e.ToResponse()).ToList()
    };
}
