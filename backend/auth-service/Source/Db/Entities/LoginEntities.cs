namespace Tdn.Db.Entities;

public class IndexedData
{
	public int Id;
}

public class UserData : IndexedData
{
    public string Username = "";
    public string PasswordHash = "";
}