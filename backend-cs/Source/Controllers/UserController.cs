using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[ApiController]
[Authorize(Policy.ResourceAccess.User)]
[Route("account")]
public class UserController : BaseController<UserContext>
{
    protected override string GetUUID() => container.ResourceInfo[Resource.User].Id.ToString();
}