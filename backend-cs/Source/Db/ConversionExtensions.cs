using TdnApi.Db.Entities;
using TdnApi.Security;

namespace TdnApi.Db.Convertors;

public static class ConversionExtensions
{
	public static Dictionary<string, object?> ToDict(this GroupData data)
	{
		return new()
		{
			{"type", "group"},
			{"id", data.Id},
			{"name", data.Name},
			{"photo_link", data.Icon}
		};
	}
	
	public static Dictionary<string, object?> ToDict(this CharacterData data, IEnumerable<NoteData>? notes = null)
	{
		Dictionary<string, object?> dict = new()
		{
			{"type", "character"},
			{"id", data.Id},
			{"name", data.Name},	
			{"description", data.Description},	
			{"group_id", data.GroupId},	
		};
		if (notes != null)
			dict.Add("notes", notes.ManyConversions(e => e.ToDict()));
		return dict;
	}
	
	public static Dictionary<string, object?> ToDict(this UserData data)
	{
		return new()
		{
			{"type", "user"},
			{"id", data.Id},
			{"first_name", data.FirstName},	
			{"last_name", data.LastName},
			{"photo_link", data.PhotoLink},
		};
	}
	
	public static void AddAccessLevel(this Dictionary<string, object?> source, AccessLevel accessLevel)
		=> source.Add("access_level", AccessLevelAlias.Convert(accessLevel));
	
	public static AccessLevel ToAccessLevel(this int level) => level < 3 && level >= 0 ? (AccessLevel)(level+1) : AccessLevel.None;
	
	public static Dictionary<string, object?> ToDict(this UserGroupData data)
	{
		var dict = new Dictionary<string, object?>();
		if (data.User != null)
			dict.Add("user", data.User.ToDict());
		if (data.Group != null)
			dict.Add("group", data.Group.ToDict());
		
		dict.AddAccessLevel(data.Privileges.ToAccessLevel());
		return dict;
	}
	
	public static Dictionary<string, object?> ToDict(this NoteData data)
	{
		Dictionary<string, object?> dict = new()
		{
			{"type", "note"},
			{"id", data.Id},
			{"header", data.Header},
			{"body", data.Body},
		};
		return dict;
	}
	
	public static Dictionary<string, object?> ToDict(this ItemData data, bool addGroup = false)
	{
		Dictionary<string, object?> dict = new()
		{
			{"type", "item"},
			{"id", data.Id},
			{"name", data.Name},
			{"description", data.Description},
			{"image_link", data.Image}
		};
		return dict;
	}
	
	public static List<Dictionary<string, object?>> ManyConversions<T>(this IEnumerable<T> values, Func<T, Dictionary<string, object?>> convert)
	{
		return values.Select(e => convert(e)).ToList();
	}
}