using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;

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

    private PolicesContext _dbContext;
    
    public GroupsPolicesController(PolicesContext context)
    {
        _dbContext = context;
    }
    
    [HttpGet]
    public ActionResult GetMany([FromQuery] int? userId = null, [FromQuery] int? groupId = null)
    {
        var groups = _dbContext.Groups.Where(e => true);
        if (userId != null)
            groups = groups.Where(e => e.UserId == (int)userId);
        if (groupId != null)
            groups = groups.Where(e => e.GroupId == (int)groupId);
        var result = new
            {
                users = groups.Select(e =>
                    new
                    {
                        userId = e.UserId,
                        groupId = e.GroupId,
                        isAdmin = e.IsAdmin,
                        characters = _dbContext.Characters
                            .Where(c => c.UserId == e.UserId && c.GroupId == e.GroupId)
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
        var rule = _dbContext.Groups.Where(e => e.GroupId == (int)data.GroupId && e.UserId == (int)data.UserId).FirstOrDefault();
        ActionResult result;
        if (rule == null)
        {
            _dbContext.Groups.Add(new Db.Entities.UserGroupData()
            {
                UserId = (int)data.UserId, 
                GroupId = (int)data.GroupId,
                IsAdmin = data.IsAdmin != null ? (bool)data.IsAdmin : false
            });
            result = Created("", null);
        }
        else
        {
            rule.IsAdmin = data.IsAdmin != null ? (bool)data.IsAdmin : rule.IsAdmin;
            result = Ok();
        }
        _dbContext.SaveChanges();
        return result;
    }
    
    [HttpPut("characters")]
    public ActionResult PutCharacterRule([FromBody] CharacterPutData data)
    {
        if (data.GroupId == null || data.UserId == null || data.CharacterId == null)
            return BadRequest();
        var rule = _dbContext.Characters.Where(e => e.GroupId == (int)data.GroupId && e.UserId == (int)data.UserId && e.CharacterId == (int)data.CharacterId).FirstOrDefault();
        ActionResult result;
        if (rule == null)
        {
            if (!_dbContext.Groups.Any(e => e.GroupId == (int)data.GroupId && e.UserId == (int)data.UserId))
                return NotFound();
            _dbContext.Characters.Add(new Db.Entities.UserCharacterData()
            {
                UserId = (int)data.UserId, 
                GroupId = (int)data.GroupId,
                CharacterId = (int)data.CharacterId,
                CanWrite = data.CanWrite != null ? (bool)data.CanWrite : false
            });
            result = Created("", null);
        }
        else
        {
            rule.CanWrite = data.CanWrite != null ? (bool)data.CanWrite : rule.CanWrite;
            result = Ok();
        }
        _dbContext.SaveChanges();
        return result;
    }
    
    [HttpDelete]
    public ActionResult DeleteRule([FromQuery] int userId, [FromQuery, Required] int groupId, [FromQuery] int? characterId)
    {
        if (characterId != null)
        {
            var character = _dbContext.Characters.Where(e => e.UserId == userId && e.CharacterId == (int)characterId && e.GroupId == groupId).FirstOrDefault();
            if (character == null)
                return NotFound();
            _dbContext.Characters.Remove(character);
        }
        else
        {
            var group = _dbContext.Groups.Where(e => e.UserId == userId && e.GroupId == groupId).FirstOrDefault();
            if (group == null)
                return NotFound();
            _dbContext.Characters.RemoveRange(_dbContext.Characters.Where(e => e.GroupId == groupId && e.UserId == userId));
            _dbContext.Groups.Remove(group);
        };
        _dbContext.SaveChanges();
        return Ok();
    }
}