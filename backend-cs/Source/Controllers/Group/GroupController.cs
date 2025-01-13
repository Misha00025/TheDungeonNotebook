using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Api.Models.Inputs;
using TdnApi.Db.Contexts;
using TdnApi.Db.Entities;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Group)]
[Route("groups/{group_id}")]
public class GroupController : BaseController<GroupContext>
{	
	public GroupController(GroupContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
	}

	protected HttpResourceInfo Info => _container.ResourceInfo[Resource.Group];
	
	[HttpGet]
	public ActionResult GetInfo()
	{
		GroupData data = _dbContext.Groups.Where(e => e.Id == Info.Id).First();
		var result = DataConverter.ConvertToDict(data);
		result = DataConverter.AddAccessLevelNullable(result, Info.AccessLevel);
		return Ok(result);
	}
	
	[HttpDelete]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteGroup()
	{
		GroupData data = _dbContext.Groups.Where(e => e.Id == Info.Id).First();
		var oldData = DataConverter.ConvertToDict(data);
		if (!IsDebug())
			_dbContext.Groups.Remove(data);
		return Ok(oldData);
	}
	
	[HttpGet("characters")]
	public ActionResult GetCharacters()
	{
		// TODO: add implementation
		return Ok();
	}
	
	[HttpPost("characters")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddCharacter([FromBody]InputCharacter character)
	{
		// TODO: add implementation
		return Created();
	}
	
	[HttpGet("users")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult GetUsers()
	{
		// FIXME: add MongoDB methods
		var users = _dbContext.Users
				.Include(e => e.User)
				.Where(e => e.UserId == SelfId)
				.Select(e => e.User!);
		var result = DataConverter.ConvertToListNullable(users, DataConverter.ConvertToDict);
		return Ok(result);		
	}
	
	[HttpPost("users/{user_id}")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult AddUser(int user_id, int access_level = 0)
	{
		if (IsDebug())
			return Ok();
		var user = new UserGroupData();
		user.UserId = user_id;
		user.GroupId = Info.Id;
		user.Privileges = access_level;
		_dbContext.Users.Add(user);
		_dbContext.SaveChanges();
		return Created($"/groups/{Info.Id}/users", user);
	}
	
	[HttpDelete("users/{user_id}")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteUser(int user_id)
	{
		if (IsDebug())
			return Ok();		
		var user = _dbContext.Users.Where(e => e.UserId == user_id).FirstOrDefault();
		if (user == null)
			return NotFound();
		_dbContext.Users.Remove(user);
		_dbContext.SaveChanges();
		return Ok();
	}
}