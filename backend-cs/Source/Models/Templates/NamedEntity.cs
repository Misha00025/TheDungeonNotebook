namespace Tdn.Api.Models;

public class NamedEntity : Entity
{
	protected string _name;
	
	public NamedEntity(int id, string name) : base(id)
	{
		_name = name;
	}
	
	public string Name => _name;
}