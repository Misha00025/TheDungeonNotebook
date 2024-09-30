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
[Authorize(Policy = Policy.UserOrGroup)]
[Route(ApiPrefix+"groups")]
public class GroupsController : BaseController
{
	private TdnDbContext _context;
	private GroupProvider _provider;
	private UserValidator _validator;
	
	public GroupsController(TdnDbContext context)
	{
		_context = context;
		_provider = new(context);
		_validator = new UserValidator(context);
	}
	
	[HttpGet]
	public ActionResult<IEnumerable<GroupResult>> GetGroups()
	{
		if (FromGroup())
			return RedirectToRoute("GetGroup", new {id = AccessId});
		var userGroups = _provider.FindByUser(AccessId).ToArray();
		var groups = userGroups
			.Select(e => e.Group != null  
				? new GroupResult(e.Group.Id, e.Group.Name, e.IsAdmin)
				: new GroupResult("", "", false))
			.ToList();
		Dictionary<string, List<GroupResult>> result = new(){{"groups", groups}};
		return Ok(result);
	}
	
	[HttpGet("{id}", Name = "GetGroup")]
	public ActionResult<Dictionary<string, object?>> GetGroup(string id)
	{
		if (!_validator.HasAccessToGroup(id, User))
			return Forbid();
		if (FromGroup())
			return GetGroupFromGroup();
		var group = _provider.FindByUser(AccessId)
			.FirstOrDefault(e => e?.GroupId == id, null);
		if (group == null || group.Group == null)
			return NotFound();
		return Ok(GenerateResult(group.Group, group.IsAdmin));
	}
	
	private ActionResult<Dictionary<string, object?>> GetGroupFromGroup()
	{
		var res = _provider.FindById(AccessId);
		if (res == null)
			return Forbid();
		return Ok(GenerateResult(res, true));
	}
	
	private Dictionary<string, object?> GenerateResult(Group group, bool isAdmin)
	{
		var provider = new UserProvider(_context);
		var admins = provider.FindByGroup(group.Id, true);
		Dictionary<string, object?> result = new()
		{
			{"id", group.Id},
			{"name", group.Name},
			{"is_admin", true},
			{"admins", admins}
		};
		if (isAdmin)
			result.Add("users", provider.FindByGroup(group.Id));
		return result;
	}
	
	public record GroupResult(string id, string name, bool is_admin);
}