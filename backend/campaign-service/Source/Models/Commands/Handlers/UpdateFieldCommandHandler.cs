using System.Text.Json;
using Tdn.Models.Access;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands;

public class UpdateFieldCommandHandler : CommandHandler<UpdateFieldCommand>
{
    private readonly CommandsProvider _provider;
    private readonly CharacterLogProvider _log;
    private readonly SubjectAccessHelper _access;

    public UpdateFieldCommandHandler(CommandsProvider provider, CharacterLogProvider log, SubjectAccessHelper access)
    {
        _provider = provider;
        _log = log;
        _access = access;
    }

    public override string Handles => "UpdateField";

    public override UpdateFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload), FieldCommandParser.GetField(payload));

    public override CommandResult Execute(int groupId, int characterId, UpdateFieldCommand command)
    {
        var result = _provider.UpdateField(groupId, characterId, command);
        Audit(groupId, characterId, result);
        return result;
    }

    private void Audit(int groupId, int characterId, CommandResult result)
    {
        if (result.Success && result.Changed && result.Delta != 0 && result.FieldKey != null)
            _log.LogFieldChange(characterId, groupId, _access.GetCurrentActorId(), result.FieldKey, result.OldValue, result.Delta);
    }
}
