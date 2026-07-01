using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups")]
public class GroupsController : GroupsBaseController
{
    public struct GroupPostData
    {
        public string Name { get; set; }
        public string? Icon { get; set; }
        
        public GroupData ToData()
        {
            return new()
            {
                Name = Name,
                Icon = Icon
            };
        }
    }
    
    public struct GroupPatchData
    {
        public string? Name { get; set; }
        public string? Icon { get; set; }   
    }

    private GroupContext _dbContext;
    private PolicesContext _policesContext;
    
    public GroupsController(GroupContext context, GroupAccessHelper accessHelper, PolicesContext policesContext) : base(context, accessHelper)
    {
        _dbContext = context;
        _policesContext = policesContext;
    }
    
    [HttpGet]
    public ActionResult GetAll([FromQuery] int? userId = null)
    {
        var groups = _dbContext.Groups.ToList();
        if (userId != null)
        {
            var accessibleIds = AccessHelper.GetAccessibleGroupIds(userId.Value);
            groups = groups.Where(e => accessibleIds.Contains(e.Id)).ToList();
        }
        return Ok(groups.Select(e => e.ToDict()));
    }
    
    [HttpPost]
    public ActionResult PostGroup(GroupPostData data, [FromQuery] int? userId = null)
    {
        var group = data.ToData();
        _dbContext.Add(group);
        _dbContext.SaveChanges();
        
        if (userId != null)
        {
            _policesContext.Groups.Add(new UserGroupData()
            {
                UserId = userId.Value,
                GroupId = group.Id,
                IsAdmin = true
            });
            _policesContext.SaveChanges();
        }
        
        return Created($"groups/{group.Id}", group.ToDict());
    }
    
    [HttpGet("{groupId}")]
    public ActionResult GetGroup(int groupId, [FromQuery] int? userId = null)
    {
        var group = _dbContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (group == null)
            return NotFound();
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        return Ok(group.ToDict());
    }
    
    [HttpPatch("{groupId}")]
    public ActionResult PatchGroup(int groupId, GroupPatchData data, [FromQuery] int? userId = null)
    {
        if (data.Icon == null && data.Name == null)
            return BadRequest();
        var group = _dbContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (group == null)
            return NotFound();
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        if (data.Name != null)
            group.Name = data.Name;
        if (data.Icon != null)
            group.Icon = data.Icon;
        _dbContext.SaveChanges();
        return Ok(group.ToDict());
    }
    
    [HttpDelete("{groupId}")]
    public ActionResult DeleteGroup(int groupId, [FromQuery] int? userId = null)
    {
        var group = _dbContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (group == null)
            return NotFound();
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        _dbContext.Groups.Remove(group);
        _dbContext.SaveChanges();
        return Ok(group.ToDict());
    }
}
