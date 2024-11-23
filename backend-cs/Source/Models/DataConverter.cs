using TdnApi.Db.Entities;

namespace Tdn.Api.Models;

public class DataConverter
{
	public List<Dictionary<string, object>> ConvertToList<T>(IEnumerable<T> values, Func<T, Dictionary<string, object>> convert)
	{
		return values.Select(e => convert(e)).ToList();
	}
	
	public Dictionary<string, object> ConvertToDict(GroupData data)
	{
		Dictionary<string, object> result = new()
		{
			{"id", data.Id},
			{"name", data.Name},
		};
		return result;
	}
	
	public Dictionary<string, object> ConvertToDict(CharacterData data)
	{
		Dictionary<string, object> result = new()
		{
			{"id", data.Id},
			{"name", data.Name},	
			{"description", data.Description},	
			{"group_id", data.GroupId},	
		};
		return result;
	}
}