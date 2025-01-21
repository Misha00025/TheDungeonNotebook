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
			{"icon", model.Icon}
		};
		if (addGroups)
		{
			var groups = model.PrepareGroups();
			result.Add("groups", groups);
		}
		return result;
	}
	
	private static List<Dictionary<string, object>> PrepareGroups(this User model)
	{
		return new();
	}
}