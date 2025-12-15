using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/items")]
public class GroupItemsController : GroupsBaseController
{
    private ItemsProvider _provider;
    
    public GroupItemsController(GroupContext groupContext, ItemsProvider provider) : base(groupContext)
    {
        _provider = provider;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId, bool withSecrets = false)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var items = _provider.GetItems(groupId);
            if (!withSecrets)
                items = items.Where(e => !e.IsSecret).ToList();
            return Ok(new Dictionary<string, object>(){{"items", items.Select(e => e.ToResponse())}});
        }
        return NotFound("Group not found");
    }
    
    [HttpPost]
    public ActionResult PostItem(int groupId, [FromBody] ItemPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var item = data.AsItem(groupId);
            if (_provider.TryCreateItem(groupId, item))
                return Created($"groups/{groupId}/items/{item.Id}", item.ToResponse());
            return BadRequest("Can't create ");
        }
        return NotFound("Group not found");
    }
    
    [HttpGet("{itemId}")]
    public ActionResult GetItem(int groupId, int itemId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var item = _provider.GetItem(groupId, itemId);
            if (item == null)
                return NotFound("Item not found");
            return Ok(item.ToResponse());
        }
        return NotFound("Group not found");
    }
    
    [HttpPut("{itemId}")]
    public ActionResult PutItem(int groupId, int itemId, [FromBody] ItemPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            if (_provider.GetItem(groupId, itemId) == null)
                return NotFound("Item not found");
            var item = data.AsItem(groupId);
            item.Id = itemId;
            if (_provider.TryUpdateItem(item))
                return Ok(item.ToResponse());
            return BadRequest();
        }
        return NotFound("Group not found");
    }
    
    [HttpDelete("{itemId}")]
    public ActionResult DeleteItem(int groupId, int itemId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var item = _provider.GetItem(groupId, itemId);
            if (item == null)
                return NotFound("Item not found");
            if (_provider.TryDeleteItem(groupId, itemId))
                return Ok(item.ToResponse());
            return BadRequest();
        }
        return NotFound("Group not found");
    }
}