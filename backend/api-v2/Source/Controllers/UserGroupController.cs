using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/users")]
public class UserGroupController : BaseController
{
    private UserContext _userContext;
    private GroupContext _groupContext;
    
    public class UserAccessData
    {
        public int UserId { get; set; }
        public int? AccessLevel { get; set; }
    }

    public UserGroupController(UserContext userContext, GroupContext groupContext)
    {
        _userContext = userContext;
        _groupContext = groupContext;
    }

    private bool TryGetGroup(int groupId, out GroupData group)
    {
        var tmp = _groupContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        group = tmp!;
        return tmp != null;    
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
            var users = _groupContext.Users.Where(e => e.GroupId == groupId);
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
            if (_groupContext.Users.Any(e => e.UserId == data.UserId && e.GroupId == groupId))
                return Conflict("User+Group pair already exist");
            if (data.AccessLevel == null)
                data.AccessLevel = 0;
            var ug = new UserGroupData()
            {
                UserId = user.Id,
                GroupId = group.Id,
                Privileges = (int)data.AccessLevel
            };
            _groupContext.Users.Add(ug);
            _groupContext.SaveChanges();
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
            var ug = _groupContext.Users.Where(e => e.GroupId == groupId && e.UserId == data.UserId).Include(e => e.User).Include(e => e.Group).FirstOrDefault();
            if (ug == null)
                return PostUser(groupId, data);
            ug.Privileges = (int)data.AccessLevel;
            _groupContext.SaveChanges();
            return Ok(ug.ToDict());
        }
        return NotFound("Group not found");
    }
    
    [HttpDelete("{userId}")]
    public ActionResult DeleteUser(int groupId, int userId)
    {
        if (TryGetGroup(groupId, out var group))
        {
            var ug = _groupContext.Users.Where(e => e.GroupId == groupId && e.UserId == userId).Include(e => e.User).Include(e => e.Group).FirstOrDefault();
            if (ug == null)
                return NotFound("User Group Pair not found");
            _groupContext.Users.Remove(ug);
            _groupContext.SaveChanges();
            return Ok(ug.ToDict());
        }
        return NotFound("Group not found");
    }
}