using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters/{characterId}/equipment")]
public class CharacterEquipmentController : CharactersBaseController
{
    private CharacterEquipmentProvider _provider;

    public CharacterEquipmentController(
        EntityContext context,
        MongoDbContext mongo,
        GroupContext groupContext,
        GroupAccessHelper accessHelper,
        CharacterEquipmentProvider provider)
        : base(context, mongo, groupContext, accessHelper)
    {
        _provider = provider;
    }

    [HttpGet]
    public ActionResult GetEquipment(int groupId, int characterId, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value))
            return NotFound();
        var equipment = _provider.GetEquipment(groupId, characterId);
        return Ok(new { items = equipment });
    }

    [HttpPatch]
    public ActionResult PatchEquipment(int groupId, int characterId, [FromBody] EquipmentPatchData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.CanWriteCharacter(groupId, characterId, userId.Value))
            return Forbidden();
        bool ok;
        if (data.Action == "add")
            ok = _provider.TryAddEquipment(groupId, characterId, data.ItemId);
        else if (data.Action == "remove")
            ok = _provider.TryRemoveEquipment(groupId, characterId, data.ItemId);
        else
            return BadRequest("Action must be 'add' or 'remove'");

        if (!ok)
            return BadRequest("Failed to update equipment");
        var equipment = _provider.GetEquipment(groupId, characterId);
        return Ok(new { items = equipment });
    }

    [HttpPut]
    public ActionResult PutEquipment(int groupId, int characterId, [FromBody] EquipmentPutData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.CanWriteCharacter(groupId, characterId, userId.Value))
            return Forbidden();
        var ok = _provider.TrySaveEquipment(groupId, characterId, data.ItemIds);
        if (!ok)
            return BadRequest("Failed to save equipment");
        var equipment = _provider.GetEquipment(groupId, characterId);
        return Ok(new { items = equipment });
    }
}

public class EquipmentPatchData
{
    public string Action { get; set; } = "";
    public int ItemId { get; set; }
}

public class EquipmentPutData
{
    public List<int> ItemIds { get; set; } = new();
}
