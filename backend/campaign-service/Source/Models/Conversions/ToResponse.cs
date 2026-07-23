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
    
    public static object ToResponse(this Note note) => new
    {
        id = note.Id,
        header = note.Header,
        short_description = note.ShortDescription,
        created_at = note.CreatedAt,
        updated_at = note.UpdatedAt,
        group_id = note.GroupId,
        character_id = note.CharacterId,
        body = note.Body,
        keywords = note.Keywords
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

    public static object ToResponse(this Quest quest) => new
    {
        id = quest.Id,
        header = quest.Header,
        description = quest.Description,
        reward = quest.Reward,
        status = quest.Status,
        objectives = quest.Objectives.Select(o => o.ToResponse()),
        assignedCharacters = quest.AssignedCharacters
    };

    public static object ToResponse(this Objective objective) => new
    {
        key = objective.Key,
        description = objective.Description,
        status = objective.Status
    };
    
}