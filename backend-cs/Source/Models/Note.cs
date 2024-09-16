using Microsoft.EntityFrameworkCore;

namespace TdnApi.Models;

[PrimaryKey("Id")]
public class Note
{
	public string GroupId = "";
	public string OwnerId = "";
	public int Id = 0;
	public string Header = "";
	public string Body = "";
	public DateTime AdditionDate = DateTime.Now;
	public DateTime ModifiedDate = DateTime.Now;
	
	public User? Owner;
	public Group? Group;
}