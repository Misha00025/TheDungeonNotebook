namespace Tdn.Api.Models;

public class User
{
	private int _id;
	private string _name = "";
	private string _lastName = "";
	
	public User(int id, string name, string lastName)
	{
		_id = id;
		_name = name;
		_lastName = lastName;
	}
	
	public int Id => _id;
	public string Name => _name;
	public string LastName => _lastName;
}