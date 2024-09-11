using TdnApi.Models.Db;


namespace TdnApi.Security;

public class TokenRequirement
{
	private UserContext _userContext;
	
	public TokenRequirement(UserContext userContext)
	{
		_userContext = userContext;
	}
	
	public bool FromGroup(string token)
	{
		return token == "group";
	}
	
	public bool FromUser(string token)
	{
		return token == "user";
	}
}