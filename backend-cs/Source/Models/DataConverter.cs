using TdnApi.Db.Convertors;
using TdnApi.Db.Entities;
using TdnApi.Security;

namespace Tdn.Api.Models;

public class DataConverter
{
	public List<Dictionary<string, object?>> ConvertToList<T>(IEnumerable<T> values, Func<T, Dictionary<string, object?>> convert)
		=> values.ManyConversions(convert);
	
	public List<Dictionary<string, object?>> ConvertToListNullable<T>(IEnumerable<T> values, Func<T, Dictionary<string, object?>> convert)
		=> ConvertToList(values, convert);
	
	public Dictionary<string, object?> ConvertToDict(GroupData data)
			=> data.ToDict();
	
	public Dictionary<string, object?> ConvertToDict(CharacterData data)
			=> data.ToDict();
	
	public Dictionary<string, object?> ConvertToDict(UserData data)
			=> data.ToDict();
	
	public Dictionary<string, object?> ConvertToDict(UserGroupData data)
			=> data.ToDict();
	
	public AccessLevel ParseToAccessLevel(int level) => level < 3 && level >= 0 ? (AccessLevel)(level+1) : AccessLevel.None;  
	
	public Dictionary<string, object?> AddAccessLevel(Dictionary<string, object?> source, AccessLevel accessLevel)
	{
		source.AddAccessLevel(accessLevel);
		return source;
	}
	
	public Dictionary<string, object?> AddAccessLevelNullable(Dictionary<string, object?> source, AccessLevel accessLevel)
	{
		source.AddAccessLevel(accessLevel);
		return source;
	}
}