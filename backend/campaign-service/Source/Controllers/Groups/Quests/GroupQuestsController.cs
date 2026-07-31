using Microsoft.AspNetCore.Mvc;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;
using Tdn.Models.DTOs;
using Tdn.Models.Access;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/quests")]
public class GroupQuestsController : GroupsBaseController
{
    private QuestsProvider _provider;
    private SubjectAccessHelper _accessHelper;

    public GroupQuestsController(CampaignContext groupContext, QuestsProvider provider, GroupAccessHelper accessHelper, SubjectAccessHelper subjectAccessHelper, ILogger<GroupsBaseController> logger) 
        : base(groupContext, accessHelper, subjectAccessHelper, logger)
    {
        _provider = provider;
        _accessHelper = subjectAccessHelper;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId, int? userId, int? characterId)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        var quests = _provider.GetQuests(groupId, userId, characterId);
        return Ok(new { quests = quests.Select(e => e.ToResponse()).ToList() });
    }

    [HttpPost]
    public ActionResult PostQuest(int groupId, [FromBody] QuestPostData data)
    {
        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");
        if (string.IsNullOrEmpty(data.Header))
            return BadRequest("Header is required");
        if (!_accessHelper.IsAdmin(groupId))
        {
            // Non-admin needs at least one writable character, all must be readable
            if (data.AssignedCharacters == null || !data.AssignedCharacters.Any())
                return Forbidden();
            var hasWrite = data.AssignedCharacters.Any(c => _accessHelper.CanWriteCharacter(groupId, c));
            var allReadable = data.AssignedCharacters.All(c => _accessHelper.HasCharacterAccess(groupId, c));
            if (!hasWrite || !allReadable)
                return Forbidden();
        }
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
        if (!_accessHelper.IsAdmin(groupId))
        {
            // Non-admin can't change assignedCharacters via PATCH
            if (data.AssignedCharacters != null && data.AssignedCharacters.Any())
                return Forbidden();
        }
        if (_provider.TryPatchQuest(groupId, questId, data))
            return Ok(new { updated = true });
        return BadRequest();
    }
}
