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
    public struct ItemPostData
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public int? Price { get; set; }
        public List<AttributePostData>? Attributes { get; set; }
        public bool? IsSecret { get; set; }
    }

    private ItemsProvider _provider;
    
    private List<ValuedAttribute> AsAttributes(List<AttributePostData> data)
    {
        return data.Select(e => new ValuedAttribute()
        {
            Key = e.Key ?? "",
            Name = e.Name ?? e.Key ?? "",
            Description = e.Description ?? "",
            Value = e.Value ?? "",
        }).ToList();
    }
    
    private Item AsItem(int groupId, ItemPostData data)
    {
        return new Item(new Group(){Id = groupId})
        {
            Name = data.Name,
            Description = data.Description,
            Price = data.Price ?? 0,
            Attributes = AsAttributes(data.Attributes ?? new()),
            IsSecret = data.IsSecret ?? false
        };
    }
    
    public GroupItemsController(GroupContext groupContext, ItemsProvider provider) : base(groupContext)
    {
        _provider = provider;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            return Ok(new Dictionary<string, object>(){{"items", _provider.GetItems(groupId).Select(e => e.ToResponse())}});
        }
        return NotFound("Group not found");
    }
    
    [HttpPost]
    public ActionResult PostItem(int groupId, [FromBody] ItemPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var item = AsItem(groupId, data);
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
            var item = AsItem(groupId, data);
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