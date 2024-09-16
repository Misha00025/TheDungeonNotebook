using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Models;
using TdnApi.Models.Db;
using TdnApi.Providers;
using TdnApi.Security;
using TdnApi.Security.Validators;
using static TdnApi.Constants;

namespace TdnApi.Controllers;


[ApiController]
[Route(ApiPrefix+"users")]
public class UserController : BaseController
{
	public record PostUserData(string UserId, bool? IsAdmin);
	
	private UserGroupContext _context;
	private UserProvider _provider;
	private UserValidator _validator;
	
	public UserController(UserGroupContext userContext)
	{
		_provider = new UserProvider(userContext);
		_context = userContext;
		_validator = new UserValidator(userContext);
	}
	
	[HttpGet]
	[Authorize(Policy=Policy.UserOrGroup)]
	public ActionResult<IEnumerable<User>> GetUsers()
	{
		var id = AccessId;
		if (FromUser())
			return RedirectToRoute("GetUser", new{id = id});
		var admins = _provider.FindByGroup(id, adminsOnly: true)
			.Select(e => new UserResult(e.Id, e.FirstName, e.LastName, e.PhotoLink))
			.ToArray();
		var users = _provider.FindByGroup(id)
			.Select(e => new UserResult(e.Id, e.FirstName, e.LastName, e.PhotoLink))
			.ToArray();
		Dictionary<string, IEnumerable<UserResult>> groupUsers = new(){
			{"admins", admins}, 
			{"users", users}	
		};
		return Ok(groupUsers);
	}
	
	[HttpGet("{id}", Name = "GetUser")]
	[Authorize(Policy=Policy.UserOrGroup)]
	public ActionResult<UserResult> GetUser(string id)
	{
		if (!_validator.HasAccessToUser(id, User))
		   	return Forbid();
		var user = _provider.FindById(id);
		if (user == null)
			return NotFound();
		return Ok(new UserResult(user.Id, user.FirstName, user.LastName, user.PhotoLink));
	}
	
	[HttpDelete("{id}")]
	[Authorize(Policy = Policy.Group)]
	public ActionResult DeleteUser(string id)
	{
		if (!_validator.HasAccessToUser(id, User))
			return Forbid();
		var user = _provider.FindById(id);
		if (user == null)
			return NotFound();
		string groupId = AccessId;
		_provider.DeleteFromGroup(user, groupId);
		return Ok();
	}
	
	[HttpPost]
	[Authorize(Policy = Policy.Group)]
	public ActionResult<UserResult> PostUser(PostUserData data)
	{
		var user = _provider.FindById(data.UserId);
		string groupId = AccessId;
		if (user == null)
			return NotFound(); // FIXME: Add creating of users
		var users = _provider.FindByGroup(groupId);
		if (users.Any(e => e.Id == data.UserId))
			return Conflict();
		_provider.AddToGroup(user, groupId, data.IsAdmin == null ? false : (bool)data.IsAdmin);		
		return Created();
	}
	
	public record UserResult(
		string id, 
		string? first_name, 
		string? last_name, 
		string? photo_link
	);
}
