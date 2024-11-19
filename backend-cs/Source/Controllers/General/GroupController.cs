using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Db.Contexts;
using TdnApi.Db.Entities;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Group)]
[Route("groups/{group_id}")]
public class GroupController : ControllerBase
{
	private GroupContext _dbContext;
	private IHttpInfoContainer _container;
	
	public GroupController(GroupContext dbContext, IHttpInfoContainer container) 
	{
		_dbContext = dbContext;
		_container = container;
	}
	
	protected HttpResourceInfo Info => _container.ResourceInfo[Resource.Group];
	protected int SelfId => _container.SelfId;
	
	[HttpGet]
	public ActionResult GetInfo()
	{
		GroupData? data = _dbContext.Groups.Where(e => e.Id == Info.Id).FirstOrDefault();
		if (data == null)
			return NotFound();
		Dictionary<string, string> result = new()
		{
			{"id", data.Name},
			{"name", data.Name},
			{"access_level", AccessLevelAlias.Convert(Info.AccessLevel)}
		};
		return Ok(result);
	}
	
	[HttpDelete]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteGroup(bool debug = false)
	{
		if (debug)
			return Ok();
		return Ok();
	}
	
	[HttpGet("characters")]
	public ActionResult GetCharacters()
	{
		return Ok();
	}
	
	[HttpPost("characters")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddCharacter()
	{
		return Created("/group/characters", "OK");
	}
}