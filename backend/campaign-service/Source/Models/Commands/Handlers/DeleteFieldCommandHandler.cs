using System.Text.Json;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands;

public class DeleteFieldCommandHandler : CommandHandler<DeleteFieldCommand>
{
    private readonly CommandsProvider _provider;
    private readonly CharacterLogProvider _log;

    public DeleteFieldCommandHandler(CommandsProvider provider, CharacterLogProvider log)
    {
        _provider = provider;
        _log = log;
    }

    public override string Handles => "DeleteField";

    public override DeleteFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload));

    public override CommandResult Execute(DeleteFieldCommand command, CommandContext ctx)
    {
        if (ctx.Scope is not CharacterScope cs)
            return CommandResult.Fail(new List<string> { $"{Handles} requires a character scope" });
        var result = _provider.DeleteField(cs.GroupId, cs.CharacterId, command);
        Audit(cs.GroupId, cs.CharacterId, ctx.ActorId, result);
        return result;
    }

    private void Audit(int groupId, int characterId, int actorId, CommandResult result)
    {
        if (result.Success && result.Changed && result.Delta != 0 && result.FieldKey != null)
            _log.LogFieldChange(characterId, groupId, actorId, result.FieldKey, result.OldValue, result.Delta);
    }
}
