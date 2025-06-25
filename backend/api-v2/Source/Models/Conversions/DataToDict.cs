using Tdn.Db.Entities;

namespace Tdn.Models.Conversions;

public static class DataToDictExtensions
{
    public static Dictionary<string, object?> ToDict(this UserData data)
    {
        return new()
        {
            {"id", data.Id},
            {"firstName", data.FirstName},
            {"lastName", data.LastName},
            {"photoLink", data.PhotoLink},
        };
    }
    
    public static Dictionary<string, object?> ToDict(this GroupData data)
    {
        return new()
        {
            {"id", data.Id},
            {"name", data.Name},
            {"icon", data.Icon},
        };
    }
    
    public static Dictionary<string, object?> ToDict(this UserGroupData data)
    {
        return new()
        {
            {"user", data.User != null ? data.User.ToDict() : new UserData(){ Id = data.UserId }.ToDict()},
            {"group", data.Group != null ? data.Group.ToDict() : new GroupData(){ Id = data.GroupId }.ToDict()},
            {"accessLevel", data.Privileges}
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
    
    public static Dictionary<string, object?> ToDict(this CharlistData data, CharlistMongoData? mongoData)
    {
        return new()
        {
            {"id", data.Id},
            {"group", data.Group != null ? data.Group.ToDict() : new GroupData(){Id = data.GroupId}.ToDict()},
            {"name", mongoData?.Name},
            {"description", mongoData?.Description},
            {"fields", mongoData?.Fields.ToDict()},
        };
    }
}