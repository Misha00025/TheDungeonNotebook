using System.Text.Json;
using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands.Character;

public class UpdateFieldCommandHandler : CharacterCommandHandler<UpdateFieldCommand>
{
    public UpdateFieldCommandHandler(CharactersProvider characters, CharacterLogProvider log, ItemsProvider items)
        : base(characters, log, items)
    {
    }

    public override string Handles => "UpdateField";

    public override UpdateFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload), FieldCommandParser.GetField(payload));

    public override CommandResult Execute(UpdateFieldCommand command, CommandContext ctx)
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

        var template = _characters.GetTemplate(groupId, character.TemplateId);
        if (template == null) return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);

        if (!mongoData.Fields.ContainsKey(key))
            return CommandResult.Fail(new List<string> { $"Field with key '{key}' does not exist" });

        var field = mongoData.Fields[key];
        var oldValue = field.Value;
        ApplyFieldData(field, command.Field);
        var newValue = field.Value;

        var result = SaveAndBuildResponse(groupId, character, mongoData);
        TryAuditFieldChange(characterId, groupId, ctx.ActorId, key, oldValue, newValue);
        return result;
    }
}
