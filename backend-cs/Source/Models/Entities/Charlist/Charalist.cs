namespace Tdn.Models;

public struct CharlistInfo
{
	public int Id;
	public string Name;
	public string Description;
}

public class Charlist : Entity<CharlistInfo>
{
	private Dictionary<string, CharlistField> _fields;
	public Charlist(CharlistInfo info, Dictionary<string, CharlistField>? fields = null) : base(info)
	{
		if (fields == null)
			fields = new();
		_fields = fields;
	}

	public override void SetNewInfo(CharlistInfo info)
	{
		if (Info.Id != info.Id && info.Id != 0)
			return;
		_info.Name = info.Name;
		_info.Description = info.Description;
	}
	
	public IReadOnlyDictionary<string, CharlistField> Fields => _fields;
}