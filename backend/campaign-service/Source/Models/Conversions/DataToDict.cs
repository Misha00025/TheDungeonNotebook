using Tdn.Db.Entities;

namespace Tdn.Models.Conversions;

public static class DataToDictExtensions
{    
    public static Dictionary<string, object?> ToDict(this GroupData data)
    {
        return new()
        {
            {"id", data.Id},
            {"name", data.Name},
            {"icon", data.Icon},
        };
    }
    
    public static Dictionary<string, object?> ToDict(this Dictionary<string, FieldMongoData> fields)
    {
        var result = new Dictionary<string, object?>();
        foreach (var name in fields.Keys)
        {
            var field = fields[name];
            result.Add(name, new Dictionary<string, object?>()
            {
                {"name", field.Name},
                {"description", field.Description},
                {"value", field.Value},
            });
        }
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this GroupEntityData data, GroupEntityMongoData? groupEntity)
    {
        return new()
        {
            {"id", data.Id},
            {"group", data.Group != null ? data.Group.ToDict() : new GroupData(){Id = data.GroupId}.ToDict()},
            {"name", groupEntity?.Name},
            {"description", groupEntity?.Description},
        };
    }
    
    public static Dictionary<string, object?> ToDict(this GroupEntityData data, CharlistMongoData? mongoData)
    {
        var result = data.ToDict(mongoData as GroupEntityMongoData);
        result.Add("fields", mongoData?.Fields.ToDict());
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this GroupEntityData data, ItemMongoData? mongoData)
    {
        var result = data.ToDict(mongoData as GroupEntityMongoData);
        result.Add("price", mongoData?.Price);
        result.Add("image_link", mongoData?.Image);
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this CharacterData data, CharacterMongoData? mongoData)
    {
        var result = data.ToDict(mongoData as CharlistMongoData);
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this AmountedItemMongoData data, int index)
    {
        return new Dictionary<string, object?>()
        {
            {"id", index},
            {"name", data.Name},
            {"description", data.Description},
            {"price", data.Price},
            {"amount", data.Amount},
            {"image_link", data.Image}
        };
    }
    
    public static List<Dictionary<string, object?>> ToDict(this List<AmountedItemMongoData> dataList, int startIndex = 0)
    {
        int index = startIndex;
        return dataList.Select(e => e.ToDict(index++)).ToList();
    }
}