using System.Text.Json;
using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands.Character;

public class EquipItemCommandHandler : CharacterCommandHandler<EquipItemCommand>
{
    public EquipItemCommandHandler(CharactersProvider characters, CharacterLogProvider log, ItemsProvider items)
        : base(characters, log, items)
    {
    }

    public override string Handles => "EquipItem";

    public override EquipItemCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetItemId(payload) ?? 0);

    public override CommandResult Execute(EquipItemCommand command, CommandContext ctx)
    {
        if (ctx.Scope is not CharacterScope cs)
            return CommandResult.Fail(new List<string> { $"{Handles} requires a character scope" });

        var groupId = cs.GroupId;
        var characterId = cs.CharacterId;

        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();
        if (_items.GetItem(groupId, command.ItemId) == null)
            return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);
        mongoData.Equipment ??= new List<int>();
        if (mongoData.Equipment.Contains(command.ItemId))
            return CommandResult.Conflict($"Item '{command.ItemId}' is already equipped");

        mongoData.Equipment.Add(command.ItemId);
        var result = SaveAndBuildResponse(groupId, character, mongoData);
        _log.Log(characterId, groupId, ctx.ActorId, "EquipItem", new Dictionary<string, object?> { ["itemId"] = command.ItemId, ["oldValue"] = 0, ["delta"] = 1 });
        return result;
    }
}
