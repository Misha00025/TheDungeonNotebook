using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Commands;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters/{characterId}/commands")]
public class CharacterCommandController : GroupsBaseController
{
    private readonly ICommandDispatcher _dispatcher;
    private readonly CommandBatchProcessor _batch;

    public CharacterCommandController(
        CampaignContext context,
        SubjectAccessHelper subjectAccessHelper,
        ICommandDispatcher dispatcher,
        CommandBatchProcessor batch,
        ILogger<GroupsBaseController> logger)
        : base(context, subjectAccessHelper, logger)
    {
        _dispatcher = dispatcher;
        _batch = batch;
    }

    [HttpPost]
    public ActionResult PostCommand(int groupId, int characterId, [FromBody] CharacterCommandRequest data)
    {
        if (!SubjectAccess.CanWriteCharacter(groupId, characterId))
            return Forbidden();

        var result = _dispatcher.Dispatch(groupId, characterId, data.Type, data.Payload);

        if (result == null)
            return Unprocessable($"Unknown command type '{data.Type}'");

        return result.StatusCode switch
        {
            404 => NotFound("Character or Group not found"),
            400 => BadRequest(new { title = "CommandRejected", message = result.Message, errors = result.Errors }),
            409 => Conflict(new { title = "Conflict", message = result.Message }),
            _ => Ok(result.Data)
        };
    }

    [HttpPost("batch")]
    public ActionResult PostBatch(int groupId, int characterId, [FromBody] List<CharacterCommandRequest> commands)
    {
        if (!SubjectAccess.CanWriteCharacter(groupId, characterId))
            return Forbidden();
        if (commands == null || commands.Count == 0)
            return BadRequest(new { title = "CommandRejected", message = "Batch must contain at least one command" });

        var result = _batch.Process(groupId, characterId, commands);
        if (result.Status == 200)
            return Ok(new { results = result.Results });
        return StatusCode(result.Status, new { title = "CommandBatchFailed", results = result.Results, failedIndex = result.FailedIndex });
    }
}
