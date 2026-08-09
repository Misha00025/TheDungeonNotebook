using System.Text.Json;
using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands.Character;

public class DeleteFieldCommandHandler : CharacterCommandHandler<DeleteFieldCommand>
{
    public DeleteFieldCommandHandler(CharactersProvider characters, CharacterLogProvider log, ItemsProvider items)
        : base(characters, log, items)
    {
    }

    public override string Handles => "DeleteField";

    public override DeleteFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload));

    public override CommandResult Execute(DeleteFieldCommand command, CommandContext ctx)
    {
        if (ctx.Scope is not CharacterScope cs)
            return CommandResult.Fail(new List<string> { $"{Handles} requires a character scope" });

        var groupId = cs.GroupId;
        var characterId = cs.CharacterId;
        var key = command.Key;
        if (string.IsNullOrEmpty(key))
            return CommandResult.Fail(new List<string> { "Field key required" });

        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);

        if (!mongoData.Fields.ContainsKey(key))
            return CommandResult.NoOp();

        var oldValue = mongoData.Fields[key].Value;
        mongoData.Fields.Remove(key);

        var result = SaveAndBuildResponse(groupId, character, mongoData);
        if (oldValue != 0)
            _log.Log(characterId, groupId, ctx.ActorId, "DeleteField", new Dictionary<string, object?> { ["key"] = key, ["oldValue"] = oldValue, ["delta"] = 0 - oldValue });
        return result;
    }
}
