using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Models;
using TdnApi.Models.Db;
using TdnApi.Providers;
using TdnApi.Security;
using TdnApi.Security.Filters;
using TdnApi.Security.Validators;
using static TdnApi.Constants;

namespace TdnApi.Controllers;


[ApiController]
[Route(ApiPrefix+"users")]
public class UserController : ControllerBase
{
	public record PostUserData(string UserId, bool? IsAdmin);
	
	private UserGroupContext _context;
	private UserProvider _provider;
	
	public UserController(UserGroupContext userContext)
	{
		_provider = new UserProvider(userContext);
		_context = userContext;
	}
	
	[HttpGet]
	[Authorize(Policy=Policy.UserOrGroup)]
	public ActionResult<IEnumerable<User>> GetUsers()
	{
		var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
		var id = User.FindFirst(ClaimTypes.Name)?.Value;
		if (id == null)
			return Forbid();
		if (User.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value == Role.User))
		{
			var routeMessage = new{id = id};
			return RedirectToRoute("GetUser", routeMessage);
		}
		var admins = _provider.FindByGroup(id, true);
		var users = _provider.FindByGroup(id);
		Dictionary<string, IEnumerable<User>> groupUsers = new(){
			{"admins",admins}, 
			{"users", users}	
		};
		return Ok(groupUsers);
	}
	
	[HttpGet("{id}", Name = "GetUser")]
	[Authorize(Policy=Policy.UserOrGroup)]
	public ActionResult<User> GetUser(string id)
	{
		var validator = new UserValidator(User, _context);
		var accessId = User.FindFirst(ClaimTypes.Name)?.Value;
		if (!validator.HasAccessToUser(id) || accessId == null)
		   	return Forbid();
		var user = _provider.FindById(id);
		if (user == null)
			return NotFound();
		return Ok(user);
	}
	
	[HttpDelete("{id}")]
	[Authorize(Policy = Policy.Group)]
	public ActionResult DeleteUser(string id)
	{
		var user = _provider.FindById(id);
		string? groupId = User.FindFirst(ClaimTypes.Name)?.Value;
		var validator = new UserValidator(User, _context);
		if (groupId == null || !validator.HasAccessToUser(id))
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
		var user = _provider.FindById(data.UserId);
		string? groupId = User.FindFirst(ClaimTypes.Name)?.Value;
		if (groupId == null)
			return Forbid();
		if (user == null)
			return NotFound();
		var users = _provider.FindByGroup(groupId);
		if (users.Any(e => e.Id == data.UserId))
			return Conflict();
		_provider.AddToGroup(user, groupId, data.IsAdmin == null ? false : (bool)data.IsAdmin);		
		return Created();
	}
}
