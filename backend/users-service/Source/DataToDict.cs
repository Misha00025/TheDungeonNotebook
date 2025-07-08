using Tdn.Db.Entities;

namespace Tdn.Conversions;

public static class DataToDictExtensions
{
    public static Dictionary<string, object?> ToDict(this IndexedData data)
    {
        return new Dictionary<string, object?>(){{"id", data.Id}};
    }
    
    public static Dictionary<string, object?> ToDict(this UserData data)
    {
        var result = (data as IndexedData).ToDict();
        result.Add("nickname", data.Nickname);
        result.Add("visibleName", data.VisibleName);
        result.Add("imageLink", data.Image);
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this LinkedServicesData data)
    {
        return new()
        {
            {"user", data.User != null ? data.User.ToDict() : new UserData(){ Id = data.UserId }.ToDict() },
            {"platform", data.Platform},
            {"platformId", data.PlatformId},
        };
    }
}