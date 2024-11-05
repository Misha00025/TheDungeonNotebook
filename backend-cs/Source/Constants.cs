using TdnApi.Security;

namespace TdnApi;

public static class Constants
{
	public const string ApiPrefix = "";
}

public static class Fields
{
	public const string GroupId = "group_id";
	public const string UserId = "owner_id";
	public const string CharacterID = "character_id";
	
	public static string Convert(Resource resource)
	{
		switch(resource)
		{
			case Resource.User:
				return UserId;
			case Resource.Group:
				return GroupId;
			case Resource.Character:
				return CharacterID;
			default:
				return "";
		}
	}
}

public static class Platform
{
	public const string Tdn = "tdn";
	public const string Vk = "vk";
	public const string Tg = "tg";
}