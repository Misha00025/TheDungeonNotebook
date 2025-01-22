using Tdn.Security.Conversions;

namespace Tdn.Models.Conversions;

internal static class UserConvertExtensions
{
	public static Dictionary<string, object?> ToDict(this User model, bool addGroups = false)
	{
		var result = new Dictionary<string, object?>()
		{
			{"id", model.Id},
			{"first_name", model.FirstName},
			{"last_name", model.LastName},
			{"photo_link", model.Icon}
		};
		if (addGroups)
		{
			var groups = model.PrepareGroupsDicts();
			result.Add("groups", groups);
		}
		return result;
	}
	
	public static Dictionary<string, object?> ToDict(this User.GroupAccess group)
	{
		return new()
		{
			{"id", group.info.Id},
			{"name", group.info.Name},	
			{"photo_link", group.info.Icon},	
			{"access_level", group.accessLevel.ToAlias()},	
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