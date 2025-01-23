using Tdn.Security;

namespace Tdn.Models.Conversions;

internal static class GroupConvertExtensions
{
	public static Dictionary<string, object?> ToDict(this Group model, bool addAdmins = false, bool addUsers = false)
	{
		var result = model.Info.ToDict();
		if (addAdmins)
		{
			var users = model.PrepareUsersDicts(AccessLevel.Full);
			result.Add("admins", users);
		}
		if (addUsers)
		{
			var users = model.PrepareUsersDicts(AccessLevel.Read);
			result.Add("users", users);
		}
		return result;
	}
	
	public static Dictionary<string, object?> ToDict(this GroupInfo model)
	{
		return new()
		{
			{"id", model.Id},
			{"name", model.Name},
			{"photo_link", model.Icon}
		};
	}
	
	private static List<Dictionary<string, object?>> PrepareUsersDicts(this Group model, AccessLevel level)
	{
		IReadOnlyList<UserInfo> users;
		if (level == AccessLevel.Full)
			users = model.Admins;
		else
			users = model.Users;
		var list = new List<Dictionary<string, object?>>(users.Count);
		foreach (var user in users)
			list.Add(user.ToDict());
		return list;
	}
}