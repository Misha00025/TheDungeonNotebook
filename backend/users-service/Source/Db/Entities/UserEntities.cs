namespace Tdn.Db.Entities;

public class IndexedData
{
	public int Id;
}

public class UserData : IndexedData
{
    public string Nickname = "";
    public string VisibleName = "";
    public string Image = "";
}

public class LinkedServicesData
{
    public int UserId;
    public string Platform = "";
    public string PlatformId = "";

    public UserData? User;
}