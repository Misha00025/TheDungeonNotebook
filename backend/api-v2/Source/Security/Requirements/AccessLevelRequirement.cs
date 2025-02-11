using Microsoft.AspNetCore.Authorization;

namespace Tdn.Security;

public enum AccessLevel
{
	None,
	Read,
	Write,
	Full,
}

public class AccessLevelRequirement : IAuthorizationRequirement
{
	private int _accessLevel = 0;
	
	public AccessLevelRequirement(AccessLevel accessLevel = AccessLevel.Read)
	{
		_accessLevel = (int)accessLevel;
	}
	
	public AccessLevel AccessLevel => (AccessLevel)_accessLevel;
	public bool Verify(AccessLevel accessLevel) => (int)accessLevel >= _accessLevel && accessLevel != AccessLevel.None;
}