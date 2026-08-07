using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Conversions;
using Tdn.Models.Processing;

namespace Tdn.Models.Providing;

public class CommandsProvider
{
    private readonly CharactersProvider _characters;
    private readonly ItemsProvider _items;

    public CommandsProvider(CharactersProvider characters, ItemsProvider items)
    {
        _characters = characters;
        _items = items;
    }

    public CommandResult AddField(int groupId, int characterId, AddFieldCommand command)
    {
        var key = command.Key;
        if (string.IsNullOrEmpty(key))
            return CommandResult.Fail(new List<string> { "Field key required" });

        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();

        var template = _characters.GetTemplate(groupId, character.TemplateId);
        if (template == null) return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);

        // AddField must NOT override a field already on the character (that is UpdateField's job)
        if (mongoData.Fields.ContainsKey(key))
            return CommandResult.Conflict($"Field with key '{key}' already exists; use UpdateField");

        int oldValue = 0;
        FieldMongoData field;
        if (template.Fields.ContainsKey(key))
        {
            // template default not yet materialized -> allowed to create/override
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

        var result = Save(groupId, character, mongoData);
        result.FieldKey = key;
        result.OldValue = oldValue;
        result.NewValue = newValue;
        result.Changed = true;
        return result;
    }

    public CommandResult UpdateField(int groupId, int characterId, UpdateFieldCommand command)
    {
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

        var result = Save(groupId, character, mongoData);
        result.FieldKey = key;
        result.OldValue = oldValue;
        result.NewValue = newValue;
        result.Changed = true;
        return result;
    }

    public CommandResult DeleteField(int groupId, int characterId, DeleteFieldCommand command)
    {
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

        var result = Save(groupId, character, mongoData);
        result.FieldKey = key;
        result.OldValue = oldValue;
        result.NewValue = 0;
        result.Changed = true;
        return result;
    }

    public CommandResult EquipItem(int groupId, int characterId, EquipItemCommand command)
    {
        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();
        if (_items.GetItem(groupId, command.ItemId) == null)
            return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);
        mongoData.Equipment ??= new List<int>();
        if (mongoData.Equipment.Contains(command.ItemId))
            return CommandResult.Conflict($"Item '{command.ItemId}' is already equipped");

        mongoData.Equipment.Add(command.ItemId);
        var result = Save(groupId, character, mongoData);
        result.FieldKey = command.ItemId.ToString();
        result.OldValue = 0;
        result.NewValue = 1;
        result.Changed = true;
        return result;
    }

    public CommandResult UnequipItem(int groupId, int characterId, UnequipItemCommand command)
    {
        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);
        mongoData.Equipment ??= new List<int>();
        if (!mongoData.Equipment.Contains(command.ItemId))
            return CommandResult.NoOp();

        mongoData.Equipment.Remove(command.ItemId);
        var result = Save(groupId, character, mongoData);
        result.FieldKey = command.ItemId.ToString();
        result.OldValue = 1;
        result.NewValue = 0;
        result.Changed = true;
        return result;
    }

    private CommandResult Save(int groupId, Character character, CharacterMongoData mongoData)
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

    private static FieldMongoData CloneField(FieldMongoData source) => new PropertyMongoData
    {
        Name = source.Name,
        Description = source.Description,
        Value = source.Value,
        Formula = source.Formula,
        MaxValue = source is PropertyMongoData p ? p.MaxValue : 0
    };

    private static FieldMongoData BuildField(FieldCommandData d)
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

    private static void ApplyFieldData(FieldMongoData target, FieldCommandData? data)
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
