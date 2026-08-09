using System.Text.Json;
using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Providing;
using Tdn.Db.Entities;

namespace Tdn.Models.Commands.Character;

public class AddFieldCommandHandler : CharacterCommandHandler<AddFieldCommand>
{
    public AddFieldCommandHandler(CharactersProvider characters, CharacterLogProvider log, ItemsProvider items)
        : base(characters, log, items)
    {
    }

    public override string Handles => "AddField";

    public override AddFieldCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetKey(payload), FieldCommandParser.GetField(payload));

    public override CommandResult Execute(AddFieldCommand command, CommandContext ctx)
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

        if (mongoData.Fields.ContainsKey(key))
            return CommandResult.Conflict($"Field with key '{key}' already exists; use UpdateField");

        int oldValue = 0;
        FieldMongoData field;
        if (template.Fields.ContainsKey(key))
        {
            oldValue = template.Fields[key].Value;
            field = CloneField(template.Fields[key]);
            mongoData.Fields[key] = field;
        }
        else
        {
            if (command.Field == null || string.IsNullOrEmpty(command.Field.Value.Name))
                return CommandResult.Fail(new List<string>
                { $"Can't create field with key '{key}': name and description must be not null" });
            field = BuildField(command.Field.Value);
            mongoData.Fields[key] = field;
        }

        ApplyFieldData(field, command.Field);
        var newValue = field.Value;

        var result = SaveAndBuildResponse(groupId, character, mongoData);
        TryAuditFieldChange(characterId, groupId, ctx.ActorId, key, oldValue, newValue);
        return result;
    }
}
