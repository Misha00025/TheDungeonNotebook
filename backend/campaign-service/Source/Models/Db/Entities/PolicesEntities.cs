namespace Tdn.Db.Entities;

public class UserGroupData
{
    public int UserId { get; set; }
    public int GroupId { get; set; }
    public bool IsAdmin { get; set; } 
}

public class UserCharacterData
{
    public int UserId { get; set; }
    public int GroupId { get; set; }
    public int CharacterId { get; set; }
    public bool CanWrite { get; set; }
    public UserGroupData? Group { get; set; }
}
