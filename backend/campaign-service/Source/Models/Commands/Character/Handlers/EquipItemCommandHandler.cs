using System.Text.Json;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands;

public class EquipItemCommandHandler : CommandHandler<EquipItemCommand>
{
    private readonly CommandsProvider _provider;
    private readonly CharacterLogProvider _log;

    public EquipItemCommandHandler(CommandsProvider provider, CharacterLogProvider log)
    {
        _provider = provider;
        _log = log;
    }

    public override string Handles => "EquipItem";

    public override EquipItemCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetItemId(payload) ?? 0);

    public override CommandResult Execute(EquipItemCommand command, CommandContext ctx)
    {
        if (ctx.Scope is not CharacterScope cs)
            return CommandResult.Fail(new List<string> { $"{Handles} requires a character scope" });
        var result = _provider.EquipItem(cs.GroupId, cs.CharacterId, command);
        Audit(cs.GroupId, cs.CharacterId, ctx.ActorId, result);
        return result;
    }

    private void Audit(int groupId, int characterId, int actorId, CommandResult result)
    {
        if (result.Success && result.Changed && result.Delta != 0 && result.FieldKey != null)
            _log.LogEquipmentChange(characterId, groupId, actorId, int.Parse(result.FieldKey), result.OldValue, result.Delta);
    }
}
