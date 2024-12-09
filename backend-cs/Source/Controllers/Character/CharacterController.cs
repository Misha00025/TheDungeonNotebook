using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TdnApi.Db.Contexts;
using TdnApi.Db.Entities;
using TdnApi.Parsing.Http;
using TdnApi.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Character)]
[Route("characters/{character_id}")]
public class CharacterController : BaseController<CharacterContext>
{
	public CharacterController(CharacterContext dbContext, IHttpInfoContainer container) : base(dbContext, container)
	{
	}

	private HttpResourceInfo Info => _container.ResourceInfo[Resource.Character];

	private int CharacterId 
	{
		get
		{
			return Info.Id;
		}
	}

	private List<Dictionary<string, object>> GenerateOwners()
	{
		var tmpOwners = _dbContext.Owners
				.Where(e => e.CharacterId == CharacterId)
				.Include(e => e.User);
		var owners = DataConverter.ConvertToList(tmpOwners, e => {var d = DataConverter.ConvertToDict(e); d.Remove("character"); return d;});
		if (owners == null)
			owners = new List<Dictionary<string, object>>();
		return owners;
	}
	
	public bool TryGetCharacter(out CharacterData characterData)
	{
		var character = _dbContext.Characters.Where(e => e.Id == CharacterId).FirstOrDefault();
		characterData = character != null ? character : new CharacterData();
		return character != null;
	}
	
	[HttpGet]
	public ActionResult GetInfo(bool with_owners = false)
	{
		if (!TryGetCharacter(out var character))
			return NotFound();
		var result = DataConverter.ConvertToDict(character);
		if (with_owners && Info.AccessLevel == AccessLevel.Full)
		{
			var owners = GenerateOwners();
			result.Add("owners", owners);
		}		
		return Ok(result);
	}
	
	
	[HttpDelete]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteCharacter()
	{
		if (!TryGetCharacter(out var character))
			return NotFound();
		if (IsDebug())
			return Ok();
		_dbContext.Characters.Remove(character);	
		return Ok();
	}
	
	[HttpGet("owners")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult GetOwners()
	{
		Dictionary<string, object> result = new(){
			{"owners", GenerateOwners()}
		};
		return Ok(result);
	}
	
	[HttpPost("owners/{owner_id}")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult AddOwner(int owner_id, int access_level = 0)
	{
		// TODO: Добавить обработку добавления владельца
		// return StatusCode(501);
		if (IsDebug())
			return Ok();
		var owner = new UserCharacterData();
		owner.UserId = owner_id;
		owner.CharacterId = CharacterId;
		owner.Privileges = access_level;
		_dbContext.Owners.Add(owner);
		_dbContext.SaveChanges();
		Console.WriteLine($"---------\nDebug: {IsDebug()}\nOwner Id: {owner_id}\nOwner: {owner}\n----------");
		return Created($"/characters/{CharacterId}/owners", owner);
	}
	
	[HttpDelete("owners/{owner_id}")]
	[Authorize(Policy.AccessLevel.Admin)]
	public ActionResult DeleteOwner(int owner_id)
	{
		// TODO: Добавить обработку удаления владельца
		// return StatusCode(501);
		if (IsDebug())
			return Ok();
		
		var owner = _dbContext.Owners.Where(e => e.UserId == owner_id).FirstOrDefault();
		Console.WriteLine($"---------\nDebug: {IsDebug()}\nOwner Id: {owner_id}\nOwner: {owner}\n----------");
		if (owner == null)
			return NotFound();
		_dbContext.Owners.Remove(owner);
		_dbContext.SaveChanges();
		return Ok();
	}
}