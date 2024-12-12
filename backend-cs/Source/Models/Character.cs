namespace Tdn.Api.Models;

public class Character : DescribedEntity
{	
	public Character(int id, string name, string description = "") : base(id, name, description)
	{
	}
}