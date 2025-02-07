using System.Security.Claims;
using Tdn.Security.Conversions;

namespace Tdn.Security;

public interface IAccessContext
{
	int SelfId { get; }
	string AccessType { get; }
	IReadOnlyDictionary<Resource, ResourceAccessInfo> ResourceInfo { get; }
	bool Has(Resource resource);
}

public struct ResourceAccessInfo
{
	public int Id;
	public AccessLevel AccessLevel;
}

public class AccessContext : IAccessContext
{	
	
	private readonly Dictionary<Resource, ResourceAccessInfo> _accessCollection = new();
	private readonly IAccessLevelProvider _provider;
	private readonly HttpParser _httpParser;
	
	public AccessContext(IHttpContextAccessor contextAccessor, IAccessLevelProvider accessProvider)
	{
		_provider = accessProvider;
		_httpParser = new();
		var context = contextAccessor.HttpContext;
		if (context == null)
			return;
		string? role = context.User.Claims.FirstOrDefault(
							e => e.Type == ClaimTypes.Role && (e.Value == Role.Group || e.Value == Role.User)
						)?.Value;
		if (role == null)
			return;
		AccessType = role;
		foreach (Resource resource in Enum.GetValues(typeof(Resource)))
			TryAddInfoFor(resource, context);
	}
	
	private AccessLevel GetAccessLevel(Resource resource, int id, string name, string role) 
			=> _provider.AccessTo(resource, name, id.ToString(), role);
	private string GetFieldName(Resource resource) 
			=> resource.GetFieldName();

	private void TryAddInfoFor(Resource resource, HttpContext context)
	{
		var fieldName = GetFieldName(resource);
		int id = 0;
		if (!_httpParser.TryGetId(fieldName, context, ref id))
			if (!_httpParser.TryGetId(resource, AccessType, context, ref id))
				return;
		var name = context.User.Claims.FirstOrDefault(e => e.Type == ClaimTypes.Name)?.Value;
		if (name == null)
			return;
		if (!int.TryParse(name, out int selfId))
			return;
		SelfId = selfId;
		var accessLevel = GetAccessLevel(resource, id, name, AccessType);
		var info = new ResourceAccessInfo(){Id=id, AccessLevel=accessLevel};
		_accessCollection.Add(resource, info);
	}

	public int SelfId { get; private set; } = 0;

	public string AccessType { get; private set; } = Role.None;
	
	public IReadOnlyDictionary<Resource, ResourceAccessInfo> ResourceInfo => _accessCollection;
	public bool Has(Resource resource) =>
			ResourceInfo.ContainsKey(resource);
}