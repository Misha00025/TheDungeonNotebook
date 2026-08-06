using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Commands;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters/{characterId}/commands")]
public class CharacterCommandController : GroupsBaseController
{
    private readonly CommandDispatcher _dispatcher;

    public CharacterCommandController(
        CampaignContext context,
        SubjectAccessHelper subjectAccessHelper,
        CommandDispatcher dispatcher,
        ILogger<GroupsBaseController> logger)
        : base(context, subjectAccessHelper, logger)
    {
        _dispatcher = dispatcher;
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
}
