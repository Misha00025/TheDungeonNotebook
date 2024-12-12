namespace Tdn.Api.Models;

public class Note : DescribedEntity
{
	public Note(int id, string name, string description) : base(id, name, description)
	{
	}
	
	public string Header 
	{
		get => Name;
		set => _name = value;
	}
	
	public string Body 
	{
		get => Description;
		set => _description = value;
	}
	
	
}