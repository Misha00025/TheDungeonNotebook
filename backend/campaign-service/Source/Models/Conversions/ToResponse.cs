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
        attributes = skill.Attributes.Select(e => e.ToResponse()),
        isSecret = skill.IsSecret
    };
    
    public static object ToResponse(this Item item) => item.Amount != null ? new 
    {
        id = item.Id,
        name = item.Name,
        description = item.Description,
        attributes = item.Attributes.Select(e => e.ToResponse()),
        price = item.Price,
        amount = item.Amount,
        isSecret = item.IsSecret
    } : new 
    {
        id = item.Id,
        name = item.Name,
        description = item.Description,
        attributes = item.Attributes.Select(e => e.ToResponse()),
        price = item.Price,
        isSecret = item.IsSecret
    };
}