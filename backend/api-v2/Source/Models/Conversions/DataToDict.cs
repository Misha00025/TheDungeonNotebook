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
}