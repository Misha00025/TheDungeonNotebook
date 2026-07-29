using Microsoft.AspNetCore.Mvc;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/characters/{characterId}/items")]
public class CharacterItemsController : GroupsBaseController
{

    private ItemsProvider _provider;
    private CharacterLogProvider _logProvider;
    private CharactersProvider _charactersProvider;

    public CharacterItemsController(CampaignContext context, ItemsProvider itemsProvider, GroupAccessHelper accessHelper, CharacterLogProvider logProvider, CharactersProvider charactersProvider) : base(context, accessHelper)
    {
            _provider = itemsProvider;
            _logProvider = logProvider;
            _charactersProvider = charactersProvider;
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int characterId, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value))
            return NotFound("Character not found");
        var character = _charactersProvider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var items = _provider.GetItems(groupId, characterId);
            var result = items.Select(e => e.ToResponse()).Concat(character.Items.ToDict()).ToList();
            return Ok(new Dictionary<string, object>(){ {"items", result} });
        }
        return NotFound("Character not found");
    }
    
    [HttpPost]
    public ActionResult PostItem(int groupId, int characterId, [FromBody] ItemPostData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.CanWriteCharacter(groupId, characterId, userId.Value))
            return Forbidden();
        var character = _charactersProvider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var item = data.AsItem(groupId);
            item.IsSecret = true;
            if (_provider.TryCreateItem(groupId, item))
            {
                if (_provider.TrySetItemToCharacter(item, characterId, item.Amount ?? 0))
                {
                    if (userId != null && item.Amount != null)
                        _logProvider.LogItemChange(characterId, groupId, userId.Value, item.Id, 0, item.Amount ?? 0);
                    return Created($"groups/{groupId}/characters/{characterId}/items/{item.Id}", item.ToResponse());
                }
            }
            return BadRequest();
        }
        return NotFound("Character not found");
    }
    
    [HttpGet("{itemId}")]
    public ActionResult GetItem(int groupId, int characterId, int itemId, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value))
            return NotFound("Character not found");
        var character = _charactersProvider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var item = _provider.GetItem(groupId, itemId, characterId);
            if (item == null)
                return NotFound();
            return Ok(item.ToResponse());
        }
        return NotFound("Character not found");
    }
    
    [HttpPut("{itemId}")]
    public ActionResult PutItem(int groupId, int characterId, int itemId, [FromBody] ItemPostData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.CanWriteCharacter(groupId, characterId, userId.Value))
            return Forbidden();
        var character = _charactersProvider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var item = _provider.GetItem(groupId, itemId);
            if (item == null)
                return NotFound("Item not found");

            var charItem = _provider.GetItem(groupId, itemId, characterId);
            var oldAmount = charItem?.Amount ?? 0;
            var newAmount = data.Amount != null ? (int)data.Amount : oldAmount;
            item.Amount = newAmount;
            _provider.TrySetItemToCharacter(item, characterId, newAmount);

            if (userId != null)
            {
                var delta = newAmount - oldAmount;
                if (delta != 0)
                    _logProvider.LogItemChange(characterId, groupId, userId.Value, itemId, oldAmount, delta);
            }

            return Ok(item.ToResponse());
        }
        return NotFound("Character not found");
    }
    
    [HttpDelete("{itemId}")]
    public ActionResult DeleteItem(int groupId, int characterId, int itemId, [FromQuery] int? userId = null)
    {
        var character = _charactersProvider.GetCharacter(groupId, characterId);
        if (character != null)
        {
            var item = _provider.GetItem(groupId, itemId, characterId);
            if (item == null)
                return NotFound("Item not found");

            var oldAmount = item.Amount ?? 0;
            _provider.TryRemoveItemFromCharacter(item, characterId);

            if (userId != null && oldAmount > 0)
                _logProvider.LogItemChange(characterId, groupId, userId.Value, itemId, oldAmount, -oldAmount);

            return Ok(item.ToResponse());
        }
        return NotFound("Character not found");
    }
}
