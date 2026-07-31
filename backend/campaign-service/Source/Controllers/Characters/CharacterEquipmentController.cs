using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Providing;
using Tdn.Models.Access;
using Tdn.Models.DTOs;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters/{characterId}/equipment")]
public class CharacterEquipmentController : GroupsBaseController
{
    private CharacterEquipmentProvider _provider;
    private CharacterLogProvider _logProvider;

    public CharacterEquipmentController(
        CampaignContext context,
        SubjectAccessHelper subjectAccessHelper,
        CharacterEquipmentProvider provider,
        CharacterLogProvider logProvider,
        ILogger<GroupsBaseController> logger)
        : base(context, subjectAccessHelper, logger)
    {
        _provider = provider;
        _logProvider = logProvider;
    }

    [HttpGet]
    public ActionResult GetEquipment(int groupId, int characterId)
    {
        if (!CheckCharacterAccess(groupId, characterId))
            return NotFound();
        var equipment = _provider.GetEquipment(groupId, characterId);
        return Ok(new { items = equipment });
    }

    [HttpPatch]
    public ActionResult PatchEquipment(int groupId, int characterId, [FromBody] EquipmentPatchData data)
    {
        if (!SubjectAccess.CanWriteCharacter(groupId, characterId))
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

        int delta = data.Action == "add" ? 1 : -1;
        int oldValue = data.Action == "add" ? 0 : 1;
        _logProvider.LogEquipmentChange(characterId, groupId, SubjectAccess.CurrentUserId ?? 0, data.ItemId, oldValue, delta);

        var equipment = _provider.GetEquipment(groupId, characterId);
        return Ok(new { items = equipment });
    }

    [HttpPut]
    public ActionResult PutEquipment(int groupId, int characterId, [FromBody] EquipmentPutData data)
    {
        if (!SubjectAccess.CanWriteCharacter(groupId, characterId))
            return Forbidden();
        var ok = _provider.TrySaveEquipment(groupId, characterId, data.ItemIds);
        if (!ok)
            return BadRequest("Failed to save equipment");
        var equipment = _provider.GetEquipment(groupId, characterId);
        return Ok(new { items = equipment });
    }
}
