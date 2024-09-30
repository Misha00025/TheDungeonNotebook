using Microsoft.EntityFrameworkCore;

namespace TdnApi.Models;

[PrimaryKey("Id")]
public class Character
{
	public int Id;
	public string OwnerId = "";
	public string GroupId = "";
	public string? Name;
	public string? Description;
	
	public Group? Group;
	public User? Owner;
}