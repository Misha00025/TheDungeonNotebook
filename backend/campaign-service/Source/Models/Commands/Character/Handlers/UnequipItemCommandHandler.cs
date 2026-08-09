using System.Text.Json;
using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Providing;

namespace Tdn.Models.Commands.Character;

public class UnequipItemCommandHandler : CharacterCommandHandler<UnequipItemCommand>
{
    public UnequipItemCommandHandler(CharactersProvider characters, CharacterLogProvider log, ItemsProvider items)
        : base(characters, log, items)
    {
    }

    public override string Handles => "UnequipItem";

    public override UnequipItemCommand Parse(JsonElement payload)
        => new(FieldCommandParser.GetItemId(payload) ?? 0);

    public override CommandResult Execute(UnequipItemCommand command, CommandContext ctx)
    {
        if (ctx.Scope is not CharacterScope cs)
            return CommandResult.Fail(new List<string> { $"{Handles} requires a character scope" });

        var groupId = cs.GroupId;
        var characterId = cs.CharacterId;

        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);
        mongoData.Equipment ??= new List<int>();
        if (!mongoData.Equipment.Contains(command.ItemId))
            return CommandResult.NoOp();

        mongoData.Equipment.Remove(command.ItemId);
        var result = SaveAndBuildResponse(groupId, character, mongoData);
        TryAuditEquipmentChange(characterId, groupId, ctx.ActorId, command.ItemId, 1, 0);
        return result;
    }
}
