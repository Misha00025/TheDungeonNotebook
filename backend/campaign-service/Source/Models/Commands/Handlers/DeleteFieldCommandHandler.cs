using System.Text.Json;
using Tdn.Models.Access;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands;

public class DeleteFieldCommandHandler : CommandHandler<DeleteFieldCommand>
{
    private readonly CommandsProvider _provider;
    private readonly CharacterLogProvider _log;
    private readonly SubjectAccessHelper _access;

    public DeleteFieldCommandHandler(CommandsProvider provider, CharacterLogProvider log, SubjectAccessHelper access)
    {
        _provider = provider;
        _log = log;
        _access = access;
    }

    public override string Handles => "DeleteField";

    public override DeleteFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload));

    public override CommandResult Execute(int groupId, int characterId, DeleteFieldCommand command)
    {
        var result = _provider.DeleteField(groupId, characterId, command);
        Audit(groupId, characterId, result);
        return result;
    }

    private void Audit(int groupId, int characterId, CommandResult result)
    {
        if (result.Success && result.Changed && result.Delta != 0 && result.FieldKey != null)
            _log.LogFieldChange(characterId, groupId, _access.GetCurrentActorId(), result.FieldKey, result.OldValue, result.Delta);
    }
}
