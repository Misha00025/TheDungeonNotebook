using Microsoft.EntityFrameworkCore;

namespace TdnApi.Models.Db;

[Keyless]
public class User 
{	
	public string? Id { get; set; }
	public string? FirstName { get; set; }
	public string? LastName { get; set; }
	public string? PhotoLink { get; set; }
}