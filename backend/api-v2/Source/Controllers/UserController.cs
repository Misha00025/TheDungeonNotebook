using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("users")]
public class UserController : BaseController
{
	private UserContext _dbContext;
	public UserController(UserContext context)
	{
		_dbContext = context;
	}
	
	[HttpGet]
	public ActionResult GetAll(int? groupId = null, bool isAdmin = false)
	{
		IQueryable<UserData> users;
		if (groupId != null)
		{
			var tmp = _dbContext.Groups.Where(e => e.GroupId == groupId);
			if (isAdmin)
				tmp = tmp.Where(e => e.Privileges >= (int)AccessLevel.Full);
			users = tmp.Include(e => e.User).Select(e => e.User!);
		}
		else
		{
			users = _dbContext.Users;
		}
		return Ok(new Dictionary<string, object>(){{"users", users.ToList()}});
	}
	
	[HttpPost]
	public ActionResult AddUser(UserData data)
	{
		_dbContext.Users.Add(data); 
		return NotImplemented();
	}
	
	[HttpGet("{userId}")]
	public ActionResult GetUser(int userId)
	{
		var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
		if (user == null)
			return NotFound();
		return Ok(user);
	}

	[HttpPatch("{userId}")]
	public ActionResult PatchUser(int userId, UserData data)
	{
		
		return NotImplemented();
	}
	
	
	[HttpGet("{userId}/groups")]
	public ActionResult GetUserGroups(int userId)
	{
		return Ok();
	}
}