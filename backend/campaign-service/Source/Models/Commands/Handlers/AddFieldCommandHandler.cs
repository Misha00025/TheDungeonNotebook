using System.Text.Json;
using Tdn.Models.Access;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands;

public class AddFieldCommandHandler : CommandHandler<AddFieldCommand>
{
    private readonly CommandsProvider _provider;
    private readonly CharacterLogProvider _log;
    private readonly SubjectAccessHelper _access;

    public AddFieldCommandHandler(CommandsProvider provider, CharacterLogProvider log, SubjectAccessHelper access)
    {
        _provider = provider;
        _log = log;
        _access = access;
    }

    public override string Handles => "AddField";

    public override AddFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload), FieldCommandParser.GetField(payload));

    public override CommandResult Execute(int groupId, int characterId, AddFieldCommand command)
    {
        var result = _provider.AddField(groupId, characterId, command);
        Audit(groupId, characterId, result);
        return result;
    }

    private void Audit(int groupId, int characterId, CommandResult result)
    {
        if (result.Success && result.Changed && result.Delta != 0 && result.FieldKey != null)
            _log.LogFieldChange(characterId, groupId, _access.GetCurrentActorId(), result.FieldKey, result.OldValue, result.Delta);
    }
}
