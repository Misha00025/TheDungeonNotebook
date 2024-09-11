using Microsoft.AspNetCore.Authorization;


namespace TdnApi.Security;


public enum Access 
{
	All,
	User = 1,
	Group = 2,
	UserOrGroup = User + Group
}


public class TokenRequirement : IAuthorizationRequirement
{
	private readonly Access _access;
	public TokenRequirement(Access access)
	{
		_access = access;
	}
	public Access Access => _access;
}