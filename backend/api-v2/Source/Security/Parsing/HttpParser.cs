using System.Security.Claims;

namespace Tdn.Security;

internal class HttpParser
{
	public bool TryGetId(Resource resource, string role, HttpContext context, ref int id)
	{
		var success = (role == Role.Group && resource == Resource.Group) || (role == Role.User && resource == Resource.User);
		if (success)
		{
			var name = context.User.Claims.FirstOrDefault(e => e.Type == ClaimTypes.Name)?.Value;
			if (name == null)
				return false;
			success = int.TryParse(name, out id);
		}
		return success;
	}

	public bool TryGetId(string fieldName, HttpContext context, ref int id)
	{
		bool success = context.Request.RouteValues.ContainsKey(fieldName);
		if (success)
			success = int.TryParse(context.Request.RouteValues[fieldName]?.ToString(), out id);
		return success;
	}
}