using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Tdn.Db.Contexts;
using Tdn.Models.Providing;
using Tdn.Models.Access;
using Tdn.Models.Conversions;
using Tdn.Models.DTOs;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups")]
public class GroupsController : GroupsBaseController
{
    private GroupProvider _provider;

    public GroupsController(CampaignContext context, GroupAccessHelper accessHelper, SubjectAccessHelper subjectAccessHelper, GroupProvider provider, ILogger<GroupsBaseController> logger) : base(context, accessHelper, subjectAccessHelper, logger)
    {
        _provider = provider;
    }
    
    [HttpGet]
    public ActionResult GetAll([FromQuery] int? userId = null)
    {
        var groups = _provider.GetAll(userId);
        return Ok(groups.Select(e => e.ToDict()));
    }
    
    [HttpPost]
    public ActionResult PostGroup(GroupPostData data, [FromQuery] int? userId = null)
    {
        var group = _provider.Create(data.Name, data.Icon, userId);
        return Created($"groups/{group.Id}", group.ToDict());
    }
    
    [HttpGet("{groupId}")]
    public ActionResult GetGroup(int groupId, [FromQuery] int? userId = null)
    {
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        var group = _provider.Get(groupId);
        if (group == null)
            return NotFound();
        return Ok(group.ToDict());
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
        return Ok(group.ToDict());
    }
    
    [HttpDelete("{groupId}")]
    public ActionResult DeleteGroup(int groupId, [FromQuery] int? userId = null)
    {
        if (!CheckGroupAccess(groupId, userId))
            return NotFound();
        var group = _provider.Delete(groupId);
        if (group == null)
            return NotFound();
        return Ok(group.ToDict());
    }
}
