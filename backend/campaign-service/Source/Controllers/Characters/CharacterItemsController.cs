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
[Route("/groups/{groupId}/characters/{characterId}/items")]
public class CharacterItemsController : CharactersBaseController
{

    private ItemsProvider _provider;

    public CharacterItemsController(EntityContext context, MongoDbContext mongo, GroupContext groupContext, ItemsProvider itemsProvider) : base(context, mongo, groupContext)
    {
            _provider = itemsProvider;
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int characterId)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            var items = _provider.GetItems(groupId, characterId);
            var result = items.Select(e => e.ToResponse()).Concat(character.Items.ToDict()).ToList();
            return Ok(new Dictionary<string, object>(){ {"items", result} });
        }
        return NotFound("Character not found");
    }
    
    [HttpPost]
    public ActionResult PostItem(int groupId, int characterId, [FromBody] ItemPostData data)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            var item = data.AsItem(groupId);
            item.IsSecret = true;
            if (_provider.TryCreateItem(groupId, item))
            {
                if (_provider.TrySetItemToCharacter(item, characterId, item.Amount ?? 0))
                return Created($"groups/{groupId}/characters/{characterId}/items/{item.Id}", item.ToResponse());
            }
            return BadRequest();
        }
        return NotFound("Character not found");
    }
    
    [HttpGet("{itemId}")]
    public ActionResult GetItem(int groupId, int characterId, int itemId)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            var item = _provider.GetItem(groupId, itemId, characterId);
            if (item == null)
                return NotFound();
            return Ok(item.ToResponse());
        }
        return NotFound("Character not found");
    }
    
    [HttpPut("{itemId}")]
    public ActionResult PutItem(int groupId, int characterId, int itemId, [FromBody] ItemPostData data)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            var item = _provider.GetItem(groupId, itemId);
            if (item == null)
                return NotFound("Item not found");
            item.Amount = data.Amount != null ? (int)data.Amount : item.Amount;
            _provider.TrySetItemToCharacter(item, characterId, item.Amount ?? 0);
            return Ok(item.ToResponse());
        }
        return NotFound("Character not found");
    }
    
    [HttpDelete("{itemId}")]
    public ActionResult DeleteItem(int groupId, int characterId, int itemId)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            var item = _provider.GetItem(groupId, itemId, characterId);
            if (item == null)
                return NotFound("Item not found");
            _provider.TryRemoveItemFromCharacter(item, characterId);
            return Ok(item.ToResponse());
        }
        return NotFound("Character not found");
    }
}