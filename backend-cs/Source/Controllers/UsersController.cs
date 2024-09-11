using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TdnApi.Models.Db;
using TdnApi.Security;
using static Constants;

namespace TdnApi.Controllers;


[ApiController]
[Route(ApiPrefix+"users")]
public class UserController : ControllerBase
{
	private UserContext _userContext;
	
	public record UserInput( string firstName, string lastName );
	
	public UserController(UserContext userContext)
	{
		_userContext = userContext;
	}
	
	[HttpGet]
	public ActionResult<IEnumerable<User>> GetUsers()
	{
		return Ok(_userContext.Users.ToList());
	}
	
	[HttpGet("{id}")]
	[Authorize]
	public ActionResult<User> GetUser(string id)
	{
		var user = _userContext.Users.First(x => x.Id == id);
		return Ok(user);
	}
}
