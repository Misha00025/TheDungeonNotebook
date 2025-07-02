namespace Tdn.Db.Entities;

public class UserGroupData
{
    public int UserId;
    public int GroupId;
    public bool IsAdmin; 
}

public class UserCharacterData
{
    public int UserId;
    public int GroupId;
    public int CharacterId;
    public bool CanWrite;

    public UserGroupData? Group;
}