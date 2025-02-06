namespace Tdn.Models;

public struct CharacterInfo
{
	public CharlistInfo Charlist;
	public int? OwnerId;
}

public class Character : Charlist
{
	private Charlist _template;
	private List<Note> _notes = new();
	private List<AmountedItem> _items = new();
	
	public Character(CharacterInfo info, Charlist charlist, Dictionary<string, CharlistField>? fields = null) : base(info.Charlist, fields)
	{
		_template = charlist;
		OwnerId = info.OwnerId;
	}
	
	public int? OwnerId;
	
	public int Id => Info.Id;
	public string Name => Info.Name;
	public string Description => Info.Description;
	public Charlist Template => _template;
	
	public List<Note> Notes => _notes;
	public List<AmountedItem> Items => _items;
	
	public void ExtendNotes(IEnumerable<Note> notes)
	{
		_notes.AddRange(notes);
	}
	
	public void ExtendItems(IEnumerable<AmountedItem> items)
	{
		_items.AddRange(items);
	}
}