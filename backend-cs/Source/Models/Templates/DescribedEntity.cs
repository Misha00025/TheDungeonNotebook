namespace Tdn.Api.Models;

public class DescribedEntity : NamedEntity
{
	protected string _description;
	
	public DescribedEntity(int id, string name, string description) : base(id, name)
	{
		_description = description;
	}
	
	public string Description => _description;
}