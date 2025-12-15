namespace Tdn.Db.Entities;

public class GroupEntityData : IndexedData
{
	public int GroupId;
	public string UUID = "";
	public GroupData Group = null!;
}

public class ItemData : GroupEntityData {}
public class CharlistData : GroupEntityData {}
public class SkillData : GroupEntityData {}

public class CharacterData : GroupEntityData 
{
	public int TemplateId;
	public int? OwnerId;
	
	public CharlistData Template = null!;
}

public class CharacterSkillData
{
	public int CharacterId;
	public int SkillId;
	
	public CharacterData Character = null!;
	public SkillData Skill = null!;
}

public class CharacterItemData
{
	public int CharacterId;
	public int ItemId;
	public int Amount;
	
	public CharacterData Character = null!;
	public ItemData Item = null!;
}