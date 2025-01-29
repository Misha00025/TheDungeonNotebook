namespace Tdn.Models.Conversions;

internal static class ItemConvertExtensions
{
	public static Dictionary<string, object?> ToDict(this Item item)
	{
		return new()
		{
			{"id", item.Id},
			{"name", item.Info.Name},
			{"description", item.Info.Description}
		};
	}
	
	public static AmountedItem SetAmount(this Item item, int amount)
	{
		return new AmountedItem(item.Info, amount);
	}
}