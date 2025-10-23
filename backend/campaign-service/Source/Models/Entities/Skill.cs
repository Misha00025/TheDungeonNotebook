namespace Tdn.Models;

public class Attribute
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
	public string Description { get; set; } = "";
	public bool IsFiltered { get; set; } = false;
	public List<string> KnownValues { get; set; } = new();
}

public class ValuedAttribute
{
    public string Key = "";
    public string Name = "";
	public string Description = "";
    public string Value = "";
}

public class Skill 
{
    public int Id;
    public string Name = "";
    public string Description = "";
    public Group Group { get; private set; }
    public List<ValuedAttribute> Attributes = new ();
    public bool IsSecret;
    
    public Skill(Group group)
    {
        Group = group;
    }
}

public struct AttributePostData
{
    public string? Key { get; set; }
    public string? Name { get; set; }
    public string? Value { get; set; }
    public string? Description { get; set; }
    public bool? isFiltered { get; set; }
}


public struct SkillPostData
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public List<AttributePostData>? Attributes { get; set; }
    public bool? IsSecret { get; set; }
}
