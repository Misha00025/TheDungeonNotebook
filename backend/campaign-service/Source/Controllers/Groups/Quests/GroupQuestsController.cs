using Microsoft.AspNetCore.Mvc;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/quests")]
public class GroupQuestsController : GroupsBaseController
{
    private QuestsProvider _provider;

    public GroupQuestsController(GroupContext groupContext, QuestsProvider provider, GroupAccessHelper accessHelper) : base(groupContext, accessHelper)
    {
        _provider = provider;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId, int? userId, int? characterId)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        var quests = _provider.GetQuests(groupId, userId, characterId);
        return Ok(new Dictionary<string, object>() { { "quests", quests.Select(e => e.ToResponse()) } });
    }

    [HttpPost]
    public ActionResult PostQuest(int groupId, [FromBody] QuestPostData data)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        if (string.IsNullOrEmpty(data.Header))
            return BadRequest("Header is required");
        var quest = data.AsQuest(groupId);
        if (_provider.TryCreateQuest(groupId, quest))
            return Created($"groups/{groupId}/quests/{quest.Id}", quest.ToResponse());
        return BadRequest("Can't create quest");
    }

    [HttpGet("{questId}")]
    public ActionResult GetQuest(int groupId, int questId)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        var quest = _provider.GetQuest(groupId, questId);
        if (quest == null)
            return NotFound("Quest not found");
        return Ok(quest.ToResponse());
    }

    [HttpPut("{questId}")]
    public ActionResult PutQuest(int groupId, int questId, [FromBody] QuestPostData data)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        if (_provider.GetQuest(groupId, questId) == null)
            return NotFound("Quest not found");
        var quest = data.AsQuest(groupId);
        quest.Id = questId;
        if (_provider.TryUpdateQuest(groupId, quest))
            return Ok(quest.ToResponse());
        return BadRequest();
    }

    [HttpDelete("{questId}")]
    public ActionResult DeleteQuest(int groupId, int questId)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        if (_provider.GetQuest(groupId, questId) == null)
            return NotFound("Quest not found");
        if (_provider.TryDeleteQuest(groupId, questId))
            return Ok(new { deleted = true });
        return BadRequest();
    }

    [HttpPatch("{questId}")]
    public ActionResult PatchQuest(int groupId, int questId, [FromBody] QuestPatchData data)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        if (_provider.GetQuest(groupId, questId) == null)
            return NotFound("Quest not found");
        if (_provider.TryPatchQuest(groupId, questId, data))
            return Ok(new { updated = true });
        return BadRequest();
    }
}
