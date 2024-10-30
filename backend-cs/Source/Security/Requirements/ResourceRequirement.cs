
using Microsoft.AspNetCore.Authorization;

namespace TdnApi.Security;

public enum Resource 
{
	Group = 0,
	Character = 1,
	User = 2
}

public class ResourceRequirement : IAuthorizationRequirement
{	
	public ResourceRequirement(Resource resource)
	{
		this.Resource = resource;
	}
	public Resource Resource { get; private set; }
}