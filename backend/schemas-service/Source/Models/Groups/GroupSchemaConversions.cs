namespace Tdn.Models.Groups.Conversion;

public static class GroupSchemaConversion
{
    private static Category AsCategory(this CategoryPostData data)
    {
        var category = new Category()
        {
            Title = data.Title, 
            Filters = data.Filters.Select(e => (e.Key, e.Value)).ToList()
        };
        category.Children = data.Children.Select(e => e.AsCategory()).ToList();
        return category;
    }
    
    
    public static Schema AsSchema(this SchemaPostData data, string type)
    {
        var schema = new Schema() {Type = type};
        schema.Categories = data.Categories.Select(e => e.AsCategory()).ToList();
        return schema;
    }
    
    public static object ToResponse(this Category category) => new 
    {
        title = category.Title,
        filters = category.Filters.Select(e => new {key = e.key, value = e.value}).ToList(),
        children = category.Children.Select(e => e.ToResponse()).ToList()
    };
    
    public static object ToResponse(this Schema schema) => new
    {
        type = schema.Type,
        categories = schema.Categories.Select(e => e.ToResponse()).ToList()
    };
}