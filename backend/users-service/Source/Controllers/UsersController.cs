using Microsoft.AspNetCore.Mvc;
using Tdn.Conversions;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Api.Controllers;


[ApiController]
[Route("users")]
public class UserController : BaseController
{
    public struct UserPostData
    {
        public string Nickname { get; set; }
        public string? VisibleName { get; set; }
        public string? ImageLink { get; set; }
    }
    
    public struct UserPatchData
    {
        public string? VisibleName { get; set; }
        public string? ImageLink { get; set; }        
    }

    private UserContext _dbContext;
    
    public UserController(UserContext context)
    {
        _dbContext = context;
    }
    
    [HttpGet]
    public ActionResult GetAll([FromQuery(Name = "ids")]IEnumerable<int>? ids = null)
    {
        var users = _dbContext.Users.Where(_ => true);
        if (ids != null)
            users = users.Where(e => ids.Contains(e.Id));        
        return Ok(new Dictionary<string, object?>()
        {
            {"users", users.Select(e => e.ToDict()).ToList()}
        });
    }

    [HttpPost]
    public ActionResult PostUser([FromBody] UserPostData data)
    {
        var user = _dbContext.Users.Where(e => e.Nickname == data.Nickname).FirstOrDefault();
        if (user != null)
            return Conflict("User with this username already exist");
        user = new UserData()
        {
            Nickname = data.Nickname,
            VisibleName = data.VisibleName != null ? data.VisibleName : data.Nickname,
            Image = data.ImageLink != null ? data.ImageLink : "" 
        };
        _dbContext.Users.Add(user);
        _dbContext.SaveChanges();
        return Created($"/users/{user.Id}", user.ToDict());
    }
    
    [HttpGet("{userId}")]
    public ActionResult GetUser(int userId)
    {
        var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
        if (user == null)
            return NotFound();
        return Ok(user.ToDict());
    }
    
    [HttpPatch("{userId}")]
    public ActionResult PatchUser(int userId, [FromBody] UserPatchData data)
    {
        if (data.ImageLink == null && data.VisibleName == null)
            return BadRequest("Image Link or Visible Name must be not null");
        var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
        if (user == null)
            return NotFound();
        user.VisibleName = data.VisibleName != null ? data.VisibleName : user.VisibleName;
        user.Image = data.ImageLink != null ? data.ImageLink : user.Image;
        _dbContext.SaveChanges();
        return Ok(user.ToDict());
    }
    
    [HttpDelete("{userId}")]
    public ActionResult DeleteUser(int userId)
    {
        var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
        if (user == null)
            return NotFound();
        _dbContext.Users.Remove(user);
        _dbContext.SaveChanges();
        return Ok(user.ToDict());
    }
}