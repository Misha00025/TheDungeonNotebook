namespace Tdn.Models;

public struct CharacterInfo 
{
	public int Id;
	public string Name;
	public string Description; 
}

public class Character : Entity<CharacterInfo>
{
	private Charlist _charlist;
	public Character(CharacterInfo info, Charlist charlist) : base(info)
	{
		_charlist = charlist;
	}

	protected override void SetNewInfo(CharacterInfo info)
	{
		if (info.Id != Id && info.Id != 0)
			return;
		_info.Name = info.Name;
		_info.Description = info.Description;
	}
	
	public int Id => Info.Id;
	public string Name => Info.Name;
	public string Description => Info.Description;
	public Charlist Charlist => _charlist;
	
	
}