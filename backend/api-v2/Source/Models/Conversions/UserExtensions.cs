using Tdn.Db.Entities;

namespace Tdn.Models.Conversions;

public static class UserExtensions
{
    public static Dictionary<string, object?> ToDict(this UserData data)
    {
        return new()
        {
            {"id", data.Id},
            {"first_name", data.FirstName},
            {"last_name", data.LastName},
            {"photo_link", data.PhotoLink},
        };
    }
}