using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
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
    }
    
    public struct GroupPatchData
    {
        public string? Name { get; set; }
        public string? Icon { get; set; }   
    }

    private GroupProvider _provider;

    public GroupsController(CampaignContext context, GroupAccessHelper accessHelper, GroupProvider provider) : base(context, accessHelper)
    {
        _provider = provider;
    }
    
    [HttpGet]
    public ActionResult GetAll([FromQuery] int? userId = null)
    {
        var groups = _provider.GetAll(userId);
        return Ok(groups.Select(e => new Dictionary<string, object?>
        {
            {"id", e.Id},
            {"name", e.Name},
            {"icon", e.Icon}
        }));
    }
    
    [HttpPost]
    public ActionResult PostGroup(GroupPostData data, [FromQuery] int? userId = null)
    {
        var group = _provider.Create(data.Name, data.Icon, userId);
        return Created($"groups/{group.Id}", new Dictionary<string, object?>
        {
            {"id", group.Id},
            {"name", group.Name},
            {"icon", group.Icon}
        });
    }
    
    [HttpGet("{groupId}")]
    public ActionResult GetGroup(int groupId, [FromQuery] int? userId = null)
    {
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        var group = _provider.Get(groupId);
        if (group == null)
            return NotFound();
        return Ok(new Dictionary<string, object?>
        {
            {"id", group.Id},
            {"name", group.Name},
            {"icon", group.Icon}
        });
    }
    
    [HttpPatch("{groupId}")]
    public ActionResult PatchGroup(int groupId, GroupPatchData data, [FromQuery] int? userId = null)
    {
        if (data.Icon == null && data.Name == null)
            return BadRequest();
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        var group = _provider.Update(groupId, data.Name, data.Icon);
        if (group == null)
            return NotFound();
        return Ok(new Dictionary<string, object?>
        {
            {"id", group.Id},
            {"name", group.Name},
            {"icon", group.Icon}
        });
    }
    
    [HttpDelete("{groupId}")]
    public ActionResult DeleteGroup(int groupId, [FromQuery] int? userId = null)
    {
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        var group = _provider.Delete(groupId);
        if (group == null)
            return NotFound();
        return Ok(new Dictionary<string, object?>
        {
            {"id", group.Id},
            {"name", group.Name},
            {"icon", group.Icon}
        });
    }
}
