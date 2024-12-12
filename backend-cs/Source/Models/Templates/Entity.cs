namespace Tdn.Api.Models;

public class Entity
{
	private int _id;
	
	public Entity(int id)
	{
		_id = id;
	}
	
	public int Id => _id;
}