namespace Tdn.Models.Conversions;

public static class DTO
{
    public static List<ValuedAttribute> AsAttributes(this List<AttributePostData> data)
    {
        return data.Select(e => new ValuedAttribute()
        {
            Key = e.Key ?? "",
            Name = e.Name ?? e.Key ?? "",
            Description = e.Description ?? "",
            Value = e.Value ?? "",
        }).ToList();
    }

    public static Item AsItem(this ItemPostData data, int groupId)
    {
        return new Item(new Group(){Id = groupId})
        {
            Name = data.Name,
            Description = data.Description,
            Price = data.Price ?? 0,
            Amount = data.Amount,
            Attributes = AsAttributes(data.Attributes ?? new()),
            IsSecret = data.IsSecret ?? false
        };
    }
    
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
}