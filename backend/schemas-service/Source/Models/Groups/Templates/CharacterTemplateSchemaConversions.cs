namespace Tdn.Models.Groups.Templates.Conversion;

public static class CharacterTemplateSchemaConversions
{
    public static object ToResponse(this CategorySchemaMongoData category) => new 
    {
        name = category.Name,
        fields = category.Fields,
        categories = category.Categories?.Select(e => e.ToResponse()).ToList()
    };
    
    public static object ToResponse(this TemplateSchemaMongoData schema) => new
    {
        type = schema.Type,
        categories = schema.Categories.Select(e => e.ToResponse()).ToList()
    };
}