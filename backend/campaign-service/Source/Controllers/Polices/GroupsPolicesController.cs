using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Providing;
using Tdn.Models.DTOs;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("polices/groups")]
public class GroupsPolicesController : GroupsBaseController
{
    private GroupPolicesProvider _provider;
    private SubjectAccessHelper _subjectHelper;
    
    public GroupsPolicesController(CampaignContext context, GroupPolicesProvider provider, GroupAccessHelper accessHelper, SubjectAccessHelper subjectAccessHelper) : base(context, accessHelper, subjectAccessHelper)
    {
        _provider = provider;
        _subjectHelper = subjectAccessHelper;
    }
    
    [HttpGet]
    public ActionResult GetMany([FromQuery] int? userId = null, [FromQuery] int? groupId = null)
    {
        var groups = _provider.GetGroupRules(userId, groupId).ToList();
        var result = new
        {
            users = groups.Select(e =>
                new
                {
                    userId = e.UserId,
                    groupId = e.GroupId,
                    isAdmin = e.IsAdmin,
                    characters = _provider.GetCharacterRules(e.GroupId, e.UserId, null)
                        .Select(d => new
                        {
                            characterId = d.CharacterId,
                            canWrite = d.CanWrite
                        }).ToList()
                }
            ).ToList()
        };
        return Ok(result);
    }
    
    [HttpPut]
    public ActionResult PutGroupRule([FromBody] GroupPutData data)
    {
        if (data.GroupId == null || data.UserId == null)
            return BadRequest();
        if (!_subjectHelper.IsAdmin(data.GroupId.Value))
            return Forbidden();
        var (isCreated, _) = _provider.UpsertGroupRule(
            data.GroupId.Value,
            data.UserId.Value,
            data.IsAdmin ?? false);
        return isCreated ? Created("", null) : Ok();
    }
    
    [HttpGet("characters")]
    public ActionResult GetCharacterRules([FromQuery] int groupId, [FromQuery] int? userId = null, [FromQuery] int? characterId = null)
    {
        var characters = _provider.GetCharacterRules(groupId, userId, characterId)
            .Select(e => new { userId = e.UserId, canWrite = e.CanWrite })
            .ToList();
        return Ok(new { users = characters });
    }
    
    [HttpPut("characters")]
    public ActionResult PutCharacterRule([FromBody] CharacterPutData data)
    {
        if (data.GroupId == null || data.UserId == null || data.CharacterId == null)
            return BadRequest();
        if (!_subjectHelper.IsAdmin(data.GroupId.Value))
            return Forbidden();
        var result = _provider.UpsertCharacterRule(
            data.GroupId.Value,
            data.UserId.Value,
            data.CharacterId.Value,
            data.CanWrite ?? false);
        if (result == null)
            return NotFound();
        return result.Value.isCreated ? Created("", null) : Ok();
    }
    
    [HttpDelete]
    public ActionResult DeleteRule([FromQuery] int userId, [FromQuery, Required] int groupId, [FromQuery] int? characterId)
    {
        if (!_subjectHelper.IsAdmin(groupId))
            return Forbidden();
        if (!_provider.DeleteRule(userId, groupId, characterId))
            return NotFound();
        return Ok();
    }
}
