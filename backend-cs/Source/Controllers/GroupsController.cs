using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Models;
using TdnApi.Models.Db;
using TdnApi.Providers;
using TdnApi.Security;
using TdnApi.Security.Validators;

namespace TdnApi.Controllers;

[ApiController]
[Authorize(Policy = Policy.UserOrGroup)]
public class GroupsController : ControllerBase
{
	private GroupProvider _provider;
	private UserValidator _validator;
	
	public GroupsController(UserGroupContext context)
	{
		_provider = new(context);
		_validator = new UserValidator(User, context);
	}
	
	private bool FromGroup()
		=> User.FindAll(c => c.Type == ClaimTypes.Role).Any(e => e.Value == Role.Group);
	
	[HttpGet]
	public ActionResult<IEnumerable<GroupResult>> GetGroups()
	{
		var accessId = User.FindFirst(c => c.Type == ClaimTypes.Name)?.Value;
		if (FromGroup())
			return RedirectToRoute("GetGroup", new {id = accessId});
		
		return Ok();
	}
	
	[HttpGet("{id}", Name = "GetGroup")]
	public ActionResult<GroupResult> GetGroup(string id)
	{
		if (!_validator.HasAccessToGroup(id))
			return Forbid();
		if (FromGroup())
		{
			var res = _provider.FindById(id);
			if (res == null)
				return Forbid();
			return Ok(new GroupResult(res.Id, res.Name, true));
		}
		var accessId = User.FindFirst(c => c.Type == ClaimTypes.Name)?.Value;
		if (accessId == null)
			return Forbid();
		var group = _provider.FindByUser(accessId)
			.FirstOrDefault(e => e?.GroupId == id, null);
		if (group == null || group.Group == null)
			return Forbid();
		return Ok(new GroupResult(group.GroupId, group.Group.Name, group.IsAdmin));
	}
	
	public record GroupResult(string id, string name, bool isAdmin);
}