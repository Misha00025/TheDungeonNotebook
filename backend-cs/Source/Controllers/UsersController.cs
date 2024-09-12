using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Models.Db;
using TdnApi.Security;
using static Constants;
using static TdnApi.Models.Db.UserGroupContext;

namespace TdnApi.Controllers;


[ApiController]
[Route(ApiPrefix+"users")]
public class UserController : ControllerBase
{
	private UserGroupContext _userContext;
	
	public record UserInput( string firstName, string lastName );
	
	public UserController(UserGroupContext userContext)
	{
		_userContext = userContext;
	}
	
	[HttpGet]
	public ActionResult<IEnumerable<UserData>> GetUsers()
	{
		return Ok(_userContext.Users.ToList());
	}
	
	[HttpGet("{id}")]
	[Authorize(Policy=Policy.Group)]
	public ActionResult<UserData> GetUser(string id)
	{
		var user = _userContext.Users.First(x => x.Id == id);
		return Ok(user);
	}
}
