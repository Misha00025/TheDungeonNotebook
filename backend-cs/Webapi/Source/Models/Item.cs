namespace TdnApi.Models;

public class Item
{
	public int Id;
	public string GroupId = "";
	public string Name = "";
	public string Description = "";
	public string? Image;
	
	public Group? Group;
}