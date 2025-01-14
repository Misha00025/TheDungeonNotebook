using Microsoft.AspNetCore.Authorization;


namespace Tdn.Security;


public enum Access 
{
	All,
	User = 1,
	Group = 2,
	UserOrGroup = User + Group
}


public class AuthTypeRequirement : IAuthorizationRequirement
{
	private readonly Access _access;
	public AuthTypeRequirement(Access access)
	{
		_access = access;
	}
	public Access Access => _access;
}