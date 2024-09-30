using Microsoft.EntityFrameworkCore;

namespace TdnApi.Models;

[PrimaryKey("Id")]
public class Inventory
{
	public int Id;
	public int OwnerId;
	
	public Character? Owner;
}