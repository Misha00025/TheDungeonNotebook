using TdnApi.Db.Entities;
using TdnApi.Security;

namespace Tdn.Api.Models;

public class DataConverter
{
	public List<Dictionary<string, object>> ConvertToList<T>(IEnumerable<T> values, Func<T, Dictionary<string, object>> convert)
	{
		return values.Select(e => convert(e)).ToList();
	}
	
	public List<Dictionary<string, object?>> ConvertToListNullable<T>(IEnumerable<T> values, Func<T, Dictionary<string, object?>> convert)
	{
		return values.Select(e => convert(e)).ToList();
	}
	
	public Dictionary<string, object?> ConvertToDict(GroupData data)
	{
		return new()
		{
			{"id", data.Id},
			{"name", data.Name},
			{"photo_link", data.Icon}
		};
	}
	
	public Dictionary<string, object> ConvertToDict(CharacterData data)
	{
		return new()
		{
			{"id", data.Id},
			{"name", data.Name},	
			{"description", data.Description},	
			{"group_id", data.GroupId},	
		};
	}
	
	public Dictionary<string, object?> ConvertToDict(UserData data)
	{
		return new()
		{
			{"id", data.Id},
			{"first_name", data.FirstName},	
			{"last_name", data.LastName},
			{"photo_link", data.PhotoLink},
		};
	}
	
	public Dictionary<string, object?> ConvertToDict(UserGroupData data)
	{
		return AddAccessLevelNullable(new(){{"group", data.Group == null ? null : ConvertToDict(data.Group)}}, 
											ParseToAccessLevel(data.Privileges));
	}
	
	public AccessLevel ParseToAccessLevel(int level) => level < 3 && level >= 0 ? (AccessLevel)(level+1) : AccessLevel.None;  
	
	public Dictionary<string, object> AddAccessLevel(Dictionary<string, object> source, AccessLevel accessLevel)
	{
		source.Add("access_level", AccessLevelAlias.Convert(accessLevel));
		return source;
	}
	
	public Dictionary<string, object?> AddAccessLevelNullable(Dictionary<string, object?> source, AccessLevel accessLevel)
	{
		source.Add("access_level", AccessLevelAlias.Convert(accessLevel));
		return source;
	}
}