using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Conversions;
using Tdn.Models.Processing;
using Tdn.Models.Providing;
using Tdn.Db.Entities;
namespace Tdn.Models.Commands.Character;

public abstract class CharacterCommandHandler<TCommand> : CommandHandler<TCommand>
    where TCommand : ICharacterCommand
{
    protected readonly CharactersProvider _characters;
    protected readonly CharacterLogProvider _log;
    protected readonly ItemsProvider _items;

    protected CharacterCommandHandler(CharactersProvider characters, CharacterLogProvider log, ItemsProvider items)
    {
        _characters = characters;
        _log = log;
        _items = items;
    }

    protected CommandResult SaveAndBuildResponse(int groupId, global::Tdn.Models.Character character, CharacterMongoData mongoData)
    {
        character.Name = mongoData.Name;
        character.Description = mongoData.Description;
        character.Fields = mongoData.Fields;
        character.Items = mongoData.Items;
        character.Equipment = mongoData.Equipment;
        _characters.TryUpdateCharacter(character);

        var withTemplate = _characters.AsCharacterWithTemplate(character, groupId);
        FormulaCalculator.CalculateFields(withTemplate);
        var sqlData = _characters.GetCharacterSqlData(groupId, character.Id);
        var data = sqlData!.ToDict(withTemplate);
        return CommandResult.Ok(data);
    }

    protected void TryAuditFieldChange(int characterId, int groupId, int actorId, string key, int oldValue, int newValue)
    {
        var delta = newValue - oldValue;
        if (delta != 0) _log.LogFieldChange(characterId, groupId, actorId, key, oldValue, delta);
    }

    protected void TryAuditEquipmentChange(int characterId, int groupId, int actorId, int itemId, int oldValue, int newValue)
    {
        var delta = newValue - oldValue;
        if (delta != 0) _log.LogEquipmentChange(characterId, groupId, actorId, itemId, oldValue, delta);
    }

    protected static FieldMongoData CloneField(FieldMongoData source) => new PropertyMongoData
    {
        Name = source.Name,
        Description = source.Description,
        Value = source.Value,
        Formula = source.Formula,
        MaxValue = source is PropertyMongoData p ? p.MaxValue : 0
    };

    protected static FieldMongoData BuildField(FieldCommandData d)
    {
        if (!string.IsNullOrEmpty(d.ModifierFormula))
            return new ModifiedFieldMongoData
            {
                Name = d.Name ?? "",
                Description = d.Description ?? "",
                Value = d.Value ?? 0,
                Formula = d.Formula,
                ModifierFormula = d.ModifierFormula
            };
        return new PropertyMongoData
        {
            Name = d.Name ?? "",
            Description = d.Description ?? "",
            Value = d.Value ?? 0,
            Formula = d.Formula,
            MaxValue = d.MaxValue ?? 0
        };
    }

    protected static void ApplyFieldData(FieldMongoData target, FieldCommandData? data)
    {
        if (data == null) return;
        var d = data.Value;
        if (d.Name != null) target.Name = d.Name;
        if (d.Description != null) target.Description = d.Description;

        var v = d.Value;
        if (v != null) target.Value = v.Value;

        var mv = d.MaxValue;
        if (mv != null && target is PropertyMongoData prop) prop.MaxValue = mv.Value;

        if (!string.IsNullOrEmpty(d.Formula)) target.Formula = d.Formula;
    }
}
