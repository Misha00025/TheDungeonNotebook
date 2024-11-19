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
public class GroupController : BaseController<GroupContext>
{
	public GroupController(GroupContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
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
		if (IsDebug())
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
		if (IsDebug())
			return Created("/group/characters", "OK");
		return Created("/group/characters", "OK");
	}
}