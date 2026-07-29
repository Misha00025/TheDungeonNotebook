using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("polices/groups")]
public class GroupsPolicesController : BaseController
{
    public struct GroupPutData
    {
        public int? UserId { get; set; }
        public int? GroupId { get; set; }
        public bool? IsAdmin { get; set; }
    }
    
    public struct CharacterPutData
    {
        public int? UserId { get; set; }
        public int? GroupId { get; set; }      
        public int? CharacterId { get; set; }  
        public bool? CanWrite { get; set; }    
    }

    private GroupPolicesProvider _provider;
    
    public GroupsPolicesController(GroupPolicesProvider provider)
    {
        _provider = provider;
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
        if (!_provider.DeleteRule(userId, groupId, characterId))
            return NotFound();
        return Ok();
    }
}
