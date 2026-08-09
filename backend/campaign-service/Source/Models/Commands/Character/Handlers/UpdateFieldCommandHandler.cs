using System.Text.Json;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands;

public class UpdateFieldCommandHandler : CommandHandler<UpdateFieldCommand>
{
    private readonly CommandsProvider _provider;
    private readonly CharacterLogProvider _log;

    public UpdateFieldCommandHandler(CommandsProvider provider, CharacterLogProvider log)
    {
        _provider = provider;
        _log = log;
    }

    public override string Handles => "UpdateField";

    public override UpdateFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload), FieldCommandParser.GetField(payload));

    public override CommandResult Execute(UpdateFieldCommand command, CommandContext ctx)
    {
        if (ctx.Scope is not CharacterScope cs)
            return CommandResult.Fail(new List<string> { $"{Handles} requires a character scope" });
        var result = _provider.UpdateField(cs.GroupId, cs.CharacterId, command);
        Audit(cs.GroupId, cs.CharacterId, ctx.ActorId, result);
        return result;
    }

    private void Audit(int groupId, int characterId, int actorId, CommandResult result)
    {
        if (result.Success && result.Changed && result.Delta != 0 && result.FieldKey != null)
            _log.LogFieldChange(characterId, groupId, actorId, result.FieldKey, result.OldValue, result.Delta);
    }
}
