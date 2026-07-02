namespace Tdn.Db.Entities;

public class GroupEntityData : IndexedData
{
	public int GroupId { get; set; }
	public string UUID { get; set; } = "";
	public GroupData Group { get; set; } = null!;
}

public class ItemData : GroupEntityData {}
public class CharlistData : GroupEntityData {}
public class SkillData : GroupEntityData {}

public class CharacterData : GroupEntityData 
{
	public int TemplateId { get; set; }
	public int? OwnerId { get; set; }
	
	public CharlistData Template { get; set; } = null!;
}

public class CharacterSkillData
{
	public int CharacterId { get; set; }
	public int SkillId { get; set; }
	
	public CharacterData Character { get; set; } = null!;
	public SkillData Skill { get; set; } = null!;
}

public class CharacterItemData
{
	public int CharacterId { get; set; }
	public int ItemId { get; set; }
	public int Amount { get; set; }
	
	public CharacterData Character { get; set; } = null!;
	public ItemData Item { get; set; } = null!;
}