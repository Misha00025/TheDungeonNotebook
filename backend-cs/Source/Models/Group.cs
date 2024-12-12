namespace Tdn.Api.Models;

public class Group : NamedEntity
{
	private List<Character> _characters;
	
	public Group(int id, string name, List<Character> characters) : base(id, name)
	{
		_characters = characters;
	}
	
	public IReadOnlyList<Character> Characters => _characters;
	
	public void AddCharacter(Character character)
	{
		_characters.Add(character);
	}
}
