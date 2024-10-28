using Microsoft.EntityFrameworkCore;


namespace TdnApi.Models;

[PrimaryKey("Id")]
public class Group
{
	public string Id { get; set; } = "";
	public string Name { get; set; } = "";
}