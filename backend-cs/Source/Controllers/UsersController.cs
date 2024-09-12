using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Models;
using TdnApi.Models.Db;
using TdnApi.Providers;
using TdnApi.Security;
using static Constants;

namespace TdnApi.Controllers;


[ApiController]
[Route(ApiPrefix+"users")]
public class UserController : ControllerBase
{
	public record PostUserData(string UserId, bool? IsAdmin);
	
	private UserProvider _provider;
	
	public record UserInput( string firstName, string lastName );
	
	public UserController(UserGroupContext userContext)
	{
		_provider = new UserProvider(userContext);
	}
	
	[HttpGet]
	[Authorize(Policy=Policy.UserOrGroup)]
	public ActionResult<IEnumerable<User>> GetUsers(string? groupId)
	{
		 var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
		if (userRole == "user")
		{
			if (string.IsNullOrEmpty(groupId))
			{
				return BadRequest("groupId is required for users.");
			}
		}
		else if (userRole == "group")
		{
			groupId = User.FindFirst(ClaimTypes.Name)?.Value;
		}
		if (groupId == null)
			return Forbid();
		var admins = _provider.FindByGroup(groupId, true);
		var users = _provider.FindByGroup(groupId);
		Dictionary<string, IEnumerable<User>> groupUsers = new(){
			{"admins",admins}, 
			{"users", users}	
		};
		return Ok(groupUsers);
	}
	
	[HttpGet("{id}")]
	[Authorize(Policy=Policy.Group)]
	public ActionResult<User> GetUser(string id)
	{
		var user = _provider.FindByTd(id);
		if (user == null)
			return NotFound();
		return Ok(user);
	}
	
	[HttpDelete("{id}")]
	[Authorize(Policy = Policy.Group)]
	public ActionResult DeleteUser(string id)
	{
		var user = _provider.FindByTd(id);
		string? groupId = User.FindFirst(ClaimTypes.Name)?.Value;
		if (groupId == null)
			return Forbid();
		if (user == null)
			return NotFound();
		_provider.DeleteFromGroup(user, groupId);
		return Ok();
	}
	
	[HttpPost]
	[Authorize(Policy = Policy.Group)]
	public ActionResult<User> PostUser(PostUserData data)
	{
		var user = _provider.FindByTd(data.UserId);
		string? groupId = User.FindFirst(ClaimTypes.Name)?.Value;
		if (groupId == null)
			return Forbid();
		if (user == null)
			return NotFound();
		_provider.AddToGroup(user, groupId, data.IsAdmin == null ? false : (bool)data.IsAdmin);		
		return Created();
	}
}
