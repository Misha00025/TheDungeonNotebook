namespace Tdn.Models.Conversions;

internal static class UserConvertExtensions
{
	public static Dictionary<string, object?> ToDict(this User model, bool addGroups = false)
	{
		var result = model.Info.ToDict();
		if (addGroups)
		{
			var groups = model.PrepareGroupsDicts();
			result.Add("groups", groups);
		}
		return result;
	}
	
	public static Dictionary<string, object?> ToDict(this User.GroupAccess group)
	{
		var result = group.info.ToDict();
		result.Add("access_level", group.accessLevel);
		return result;
	}
	
	public static Dictionary<string, object?> ToDict(this UserInfo info)
	{
		return new Dictionary<string, object?>()
		{
			{"id", info.Id},
			{"first_name", info.FirstName},
			{"last_name", info.LastName},
			{"photo_link", info.Icon}
		};
	}
		
	private static List<Dictionary<string, object?>> PrepareGroupsDicts(this User model)
	{
		var list = new List<Dictionary<string, object?>>(model.Groups.Count);
		foreach (var group in model.Groups)
			list.Add(group.ToDict());
		return list;
	}
}