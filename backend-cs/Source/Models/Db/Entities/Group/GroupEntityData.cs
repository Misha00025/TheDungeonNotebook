namespace Tdn.Db.Entities;

public class GroupEntityData : IndexedData
{
	public int GroupId;
	public string UUID = "";
	public GroupData Group = null!;
}

public class ItemData : GroupEntityData {}
public class CharlistTemplateData : GroupEntityData {}
public class CharacterData : GroupEntityData 
{
	public int TemplateId;
	public int? OwnerId;
	
	public CharlistTemplateData Template = null!;
}