using System.Text.Json;
using Tdn.Models.Access;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands;

public class UnequipItemCommandHandler : CommandHandler<UnequipItemCommand>
{
    private readonly CommandsProvider _provider;
    private readonly CharacterLogProvider _log;
    private readonly SubjectAccessHelper _access;

    public UnequipItemCommandHandler(CommandsProvider provider, CharacterLogProvider log, SubjectAccessHelper access)
    {
        _provider = provider;
        _log = log;
        _access = access;
    }

    public override string Handles => "UnequipItem";

    public override UnequipItemCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetItemId(payload) ?? 0);

    public override CommandResult Execute(int groupId, int characterId, UnequipItemCommand command)
    {
        var result = _provider.UnequipItem(groupId, characterId, command);
        Audit(groupId, characterId, result);
        return result;
    }

    private void Audit(int groupId, int characterId, CommandResult result)
    {
        if (result.Success && result.Changed && result.Delta != 0 && result.FieldKey != null)
            _log.LogEquipmentChange(characterId, groupId, _access.GetCurrentActorId(), int.Parse(result.FieldKey), result.OldValue, result.Delta);
    }
}
