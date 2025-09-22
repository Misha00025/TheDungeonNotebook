namespace Tdn.Models.Conversions;

public static class ModelToResponseExtensions 
{
    public static object ToResponse(this Tdn.Models.Attribute attribute) => new
    {
        key = attribute.Key,
        name = attribute.Name,
        description = attribute.Description,
        knownValues = attribute.KnownValues,
        isFiltered = attribute.IsFiltered
    };

    public static object ToResponse(this ValuedAttribute attribute) => new
    {
        key = attribute.Key,
        name = attribute.Name,
        description = attribute.Description,
        value = attribute.Value
    };

    public static object ToResponse(this Skill skill) => new
    {
        id = skill.Id,
        name = skill.Name,
        description = skill.Description,
        attributes = skill.Attributes.Select(e => e.ToResponse())
    };
}