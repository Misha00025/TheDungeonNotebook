using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups")]
public class GroupsController : BaseController
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
    
    public GroupsController(GroupContext context)
    {
        _dbContext = context;
    }
    
    [HttpGet]
    public ActionResult GetAll()
    {
        var groups = _dbContext.Groups.ToList();
        return Ok(groups.Select(e => e.ToDict()));
    }
    
    [HttpPost]
    public ActionResult PostGroup(GroupPostData data)
    {
        var group = data.ToData();
        _dbContext.Add(group);
        _dbContext.SaveChanges();
        return Created($"groups/{group.Id}", group.ToDict());
    }
    
    [HttpGet("{groupId}")]
    public ActionResult GetGroup(int groupId)
    {
        var group = _dbContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (group == null)
            return NotFound();
        return Ok(group.ToDict());
    }
    
    [HttpPatch("{groupId}")]
    public ActionResult PatchGroup(int groupId, GroupPatchData data)
    {
        if (data.Icon == null && data.Name == null)
            return BadRequest();
        var group = _dbContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (group == null)
            return NotFound();
        if (data.Name != null)
            group.Name = data.Name;
        if (data.Icon != null)
            group.Icon = data.Icon;
        _dbContext.SaveChanges();
        return Ok(group.ToDict());
    }
    
    [HttpDelete("{groupId}")]
    public ActionResult DeleteGroup(int groupId)
    {
        var group = _dbContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        if (group == null)
            return NotFound();
        _dbContext.Groups.Remove(group);
        _dbContext.SaveChanges();
        return Ok(group.ToDict());
    }
}