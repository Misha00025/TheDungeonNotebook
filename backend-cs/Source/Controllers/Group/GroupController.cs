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
		result = DataConverter.AddAccessLevel(result, Info.AccessLevel);
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
		IQueryable<CharacterData> characters;
		if (Info.AccessLevel == AccessLevel.Full)
			characters = _dbContext.Characters
				.Where(e => e.GroupId == Info.Id);
		else
			characters = _dbContext.UserCharacters
				.Include(e => e.Character)
				.Where(e => e.UserId == SelfId)
				.Select(e => e.Character!);
		var result = DataConverter.ConvertToList(characters, DataConverter.ConvertToDict);
		return Ok(result);
	}
	
	[HttpPost("characters")]
	[Authorize(Policy.AccessLevel.Moderator)]
	public ActionResult AddCharacter([FromBody]InputCharacter character)
	{
		var url = $"/groups/{Info.Id}/characters/";
		CharacterData data = new CharacterData();
		Console.WriteLine($"\n\n------------\n{character.Name}, {character.Description}\n-------------\n\n");
		if (character.Name == null || character.Description == null)
			return BadRequest();
		data.Name = character.Name;
		data.Description = character.Description;
		data.GroupId = Info.Id;
		if (IsDebug())
			data.Id = 9;
		else
			_dbContext.Characters.Add(data);
		_dbContext.SaveChanges();
		return Created(url+data.Id.ToString(), DataConverter.ConvertToDict(data));
	}
}