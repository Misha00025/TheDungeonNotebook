namespace Tdn.Models.Conversions;

internal static class CharlistConvertExtensions
{
	public static Dictionary<string, object?> ToDict(this Charlist model)
	{
		return new()
		{
			{"id", model.Info.Id},
			{"name", model.Info.Name},
			{"description", model.Info.Description},
			{"fields", PrepareFields(model.Fields)}
		};
	}
	
	private static Dictionary<string, object?> PrepareFields(IReadOnlyDictionary<string, CharlistField> fields)
	{
		var result = new Dictionary<string, object?>();
		foreach (var kvp in fields)
			result.Add(kvp.Key, kvp.Value.ToDict());
		return result;
	}
	
	private static Dictionary<string, object?> ToDict(this CharlistField field)
	{
		return new()
		{
			{"name", field.Name},
			{"description", field.Description},
			{"value", field.Value}
		};
	}
}