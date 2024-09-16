using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Security;

namespace TdnApi.Controllers;


public abstract class BaseController : ControllerBase
{	
	protected string AccessId => GetUserId();
	
	private string GetUserId()
	{
		var userId = User.FindFirst(c => c.Type == ClaimTypes.Name)?.Value;
		if (userId == null)
			return "";
		return userId;
	}
	
	protected bool FromGroup()
		=> User.FindAll(c => c.Type == ClaimTypes.Role).Any(e => e.Value == Role.Group);
		
	protected bool FromUser()
		=> User.FindAll(c => c.Type == ClaimTypes.Role).Any(e => e.Value == Role.User);		
}