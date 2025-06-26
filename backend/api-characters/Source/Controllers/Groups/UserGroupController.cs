using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/users")]
public class UserGroupController : GroupsBaseController
{
    private UserContext _userContext;
    
    public class UserAccessData
    {
        public int UserId { get; set; }
        public int? AccessLevel { get; set; }
    }

    public UserGroupController(UserContext userContext, GroupContext groupContext) : base(groupContext)
    {
        _userContext = userContext;
    }
    
    private bool TryGetUser(int userId, out UserData user)
    {
        var tmp = _userContext.Users.Where(e => e.Id == userId).FirstOrDefault();
        user = tmp!;
        return tmp != null;    
    }

    [HttpGet]
    public ActionResult GetAll(int groupId, int? userId, bool adminsOnly = false)
    {
        if (TryGetGroup(groupId, out var group))
        {
            var users = GroupContext.Users.Where(e => e.GroupId == groupId);
            if (adminsOnly)
                users = users.Where(e => e.Privileges >= (int)AccessLevel.Full);
            if (userId != null)
                users = users.Where(e => e.UserId == userId);
            users.Include(e => e.Group).Include(e => e.User);
            return Ok(new Dictionary<string, object>(){{"users", users.Select(e => e.ToDict())}});   
        }
        return NotFound();
    }
    
    [HttpPost]
    public ActionResult PostUser(int groupId, [FromBody] UserAccessData data)
    {
        if (TryGetGroup(groupId, out var group))
        {
            if (!TryGetUser(data.UserId, out var user))
                return NotFound("User not found");
            if (GroupContext.Users.Any(e => e.UserId == data.UserId && e.GroupId == groupId))
                return Conflict("User+Group pair already exist");
            if (data.AccessLevel == null)
                data.AccessLevel = 0;
            var ug = new UserGroupData()
            {
                UserId = user.Id,
                GroupId = group.Id,
                Privileges = (int)data.AccessLevel
            };
            GroupContext.Users.Add(ug);
            GroupContext.SaveChanges();
            return Created($"/groups/{groupId}/users", ug.ToDict());
        }
        return NotFound("Group not found");
    }
    
    [HttpPut]
    public ActionResult PutUser(int groupId, [FromBody] UserAccessData data)
    {
        if (data.AccessLevel == null)
            return BadRequest();
        if (TryGetGroup(groupId, out var group))
        {
            if (!TryGetUser(data.UserId, out var user))
                return NotFound("User not found");
            var ug = GroupContext.Users.Where(e => e.GroupId == groupId && e.UserId == data.UserId).Include(e => e.User).Include(e => e.Group).FirstOrDefault();
            if (ug == null)
                return PostUser(groupId, data);
            ug.Privileges = (int)data.AccessLevel;
            GroupContext.SaveChanges();
            return Ok(ug.ToDict());
        }
        return NotFound("Group not found");
    }
    
    [HttpDelete("{userId}")]
    public ActionResult DeleteUser(int groupId, int userId)
    {
        if (TryGetGroup(groupId, out var group))
        {
            var ug = GroupContext.Users.Where(e => e.GroupId == groupId && e.UserId == userId).Include(e => e.User).Include(e => e.Group).FirstOrDefault();
            if (ug == null)
                return NotFound("User Group Pair not found");
            GroupContext.Users.Remove(ug);
            GroupContext.SaveChanges();
            return Ok(ug.ToDict());
        }
        return NotFound("Group not found");
    }
}