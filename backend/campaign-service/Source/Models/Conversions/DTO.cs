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

    public static Quest AsQuest(this QuestPostData data, int groupId)
    {
        return new Quest(new Group { Id = groupId })
        {
            Header = data.Header,
            Description = data.Description ?? "",
            Reward = data.Reward ?? new List<string>(),
            Status = data.Status ?? "active",
            Objectives = (data.Objectives ?? new List<ObjectivePostData>())
                .Select(o => new Objective
                {
                    Key = o.Key,
                    Description = o.Description,
                    Status = o.Status ?? "pending"
                }).ToList(),
            AssignedCharacters = data.AssignedCharacters ?? new List<int>()
        };
    }
}