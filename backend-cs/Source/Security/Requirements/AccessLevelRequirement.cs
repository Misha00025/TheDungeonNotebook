using Microsoft.AspNetCore.Authorization;

namespace TdnApi.Security;

public enum AccessLevel
{
	None,
	Full,
	Write,
	Read,
}

public class AccessLevelRequirement : IAuthorizationRequirement
{
	private int _accessLevel = 0;
	
	public AccessLevelRequirement(AccessLevel accessLevel = AccessLevel.Read)
	{
		_accessLevel = (int)AccessLevel.Read;
	}
	
	public bool Verify(AccessLevel accessLevel) => (int)accessLevel <= _accessLevel && accessLevel != AccessLevel.None;
}