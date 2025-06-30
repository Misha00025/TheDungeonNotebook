using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/characters/{characterId}/items")]
public class CharacterItemsController : CharactersBaseController
{
    public struct ItemPostData
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public int? Price { get; set; }
        public int? Amount { get; set; }
    }

    public CharacterItemsController(EntityContext context, MongoDbContext mongo, GroupContext groupContext) : base(context, mongo, groupContext)
    {
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId, int characterId)
    {
        if (TryGetCharacter(groupId, characterId, out var data, out var character))
        {
            return Ok(new Dictionary<string, object>(){ {"items", character.Items.ToDict()} });
        }
        return NotFound("Character not found");
    }
    
    [HttpPost]
    public ActionResult PostItem(int groupId, int characterId, [FromBody] ItemPostData data)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            var index = character.Items.Count;
            var item = new AmountedItemMongoData()
            {
                Name = data.Name,
                Description = data.Description,
                Price = data.Price != null ? (int)data.Price : 0,
                Amount = data.Amount != null ? (int)data.Amount : 1,                
            };
            character.Items.Add(item);
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            GetCollection().ReplaceOne(filter, character);
            return Created($"groups/{groupId}/characters/{characterId}/items/{index}", item.ToDict(index));
        }
        return NotFound("Character not found");
    }
    
    [HttpGet("{itemId}")]
    public ActionResult GetItem(int groupId, int characterId, int itemId)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            if (itemId >= character.Items.Count || itemId < 0)
                return NotFound();
            return Ok(character.Items[itemId].ToDict(itemId));
        }
        return NotFound("Character not found");
    }
    
    [HttpPut("{itemId}")]
    public ActionResult PutItem(int groupId, int characterId, int itemId, [FromBody] ItemPostData data)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            if (itemId >= character.Items.Count || itemId < 0)
                return NotFound();
            var item = character.Items[itemId];
            item.Name = data.Name;
            item.Description = data.Description;
            item.Price = data.Amount != null ? (int)data.Amount : item.Price;
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            GetCollection().ReplaceOne(filter, character);
            return Ok(item.ToDict(itemId));
        }
        return NotFound("Character not found");
    }
    
    [HttpDelete("{itemId}")]
    public ActionResult DeleteItem(int groupId, int characterId, int itemId)
    {
        if (TryGetCharacter(groupId, characterId, out var _, out var character))
        {
            if (itemId >= character.Items.Count || itemId < 0)
                return NotFound();
            var filter = Builders<CharacterMongoData>.Filter.Eq("_id", character.Id);
            var item = character.Items[itemId];
            character.Items.RemoveAt(itemId);
            GetCollection().ReplaceOne(filter, character);
            return Ok(item.ToDict(itemId));
        }
        return NotFound("Character not found");
    }
}