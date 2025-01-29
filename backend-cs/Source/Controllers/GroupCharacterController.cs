using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.Group)]
[Authorize(Policy.AccessLevel.Follower)]
[Route("groups/{"+Fields.GroupId+"}/characters")]
public class GroupCharactersController : BaseController<Group>
{
	private int GroupId => Container.ResourceInfo[Resource.Group].Id;
	protected override string GetUUID() => GroupId.ToString();
	
	private CharacterProvider _characterProvider;
	
	public GroupCharactersController(CharacterProvider characterProvider)
	{
		_characterProvider = characterProvider;
	}

	private bool IsAdmin()
	{
		return Container.ResourceInfo[Resource.Group].AccessLevel == AccessLevel.Full;
	}
	
	[HttpGet]
	public ActionResult GetCharlists()
	{
		var builder = Model.GetDictBuilder();
		builder.WithAdmins();
		if (Container.ResourceInfo[Resource.Group].AccessLevel == AccessLevel.Full)
			builder.WithUsers();
		builder.WithCharacters(_characterProvider.GetCharacters(GroupId).Where(e => e.OwnerId == SelfId || IsAdmin()));
		return Ok(builder.Build());
	}
	
}