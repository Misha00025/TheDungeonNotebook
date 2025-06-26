using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("users")]
public class UserController : BaseController
{
	public struct UserPostData
	{
		public string FirstName { get; set; }
		public string LastName { get; set; }
		public string? PhotoLink { get; set; }
		
		public UserData ToData()
		{
			return new UserData()
			{
				FirstName = this.FirstName,
				LastName = this.LastName,
				PhotoLink = this.PhotoLink
			};
		}
	}

	public struct UserUpdateData
	{
		public string? FirstName { get; set; }
		public string? LastName { get; set; }
		public string? PhotoLink { get; set; }
	}

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
		return Ok(new Dictionary<string, object>(){{"users", users.ToList().Select(e => e.ToDict())}});
	}
	
	[HttpPost]
	public ActionResult AddUser([FromBody] UserPostData data)
	{
		if (HttpContext.Request.ContentLength == 0 || data.FirstName == null || data.LastName == null)
			return BadRequest();
		var user = data.ToData();
		_dbContext.Users.Add(user);
		_dbContext.SaveChanges();
		return Created($"users/{user.Id}", user.ToDict());
	}
	
	[HttpGet("{userId}")]
	public ActionResult GetUser(int userId)
	{
		var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
		if (user == null)
			return NotFound();
		return Ok(user.ToDict());
	}

	[HttpPatch("{userId}")]
	public ActionResult PatchUser(int userId, [FromBody, Required] UserUpdateData data)
	{
		if (!(data.FirstName != null || data.LastName != null || data.PhotoLink != null))
			return BadRequest();
		var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
		if (user == null)
			return NotFound();
		if (data.FirstName != null)
			user.FirstName = data.FirstName;
		if (data.LastName != null)
			user.LastName = data.LastName;
		if (data.PhotoLink != null)
			user.PhotoLink = data.PhotoLink;
		_dbContext.SaveChanges();
		return Ok(user.ToDict());
	}
	
	[HttpDelete("{userId}")]
	public ActionResult DeleteUser(int userId)
	{
		var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
		if (user == null)
			return NotFound();
		_dbContext.Users.Remove(user);
		_dbContext.SaveChanges();
		return Ok(user.ToDict());
	}
}