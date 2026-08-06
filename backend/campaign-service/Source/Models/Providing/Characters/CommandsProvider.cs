using Tdn.Db;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Commands;
using Tdn.Models.Conversions;
using Tdn.Models.Processing;

namespace Tdn.Models.Providing;

public class CommandsProvider
{
    private readonly CharactersProvider _characters;

    public CommandsProvider(CharactersProvider characters)
    {
        _characters = characters;
    }

    public CommandResult AddField(int groupId, int characterId, CommandPayload payload) =>
        Apply(groupId, characterId, payload, add: true);

    public CommandResult UpdateField(int groupId, int characterId, CommandPayload payload) =>
        Apply(groupId, characterId, payload, add: false);

    public CommandResult DeleteField(int groupId, int characterId, CommandPayload payload)
    {
        if (string.IsNullOrEmpty(payload.Key))
            return CommandResult.Fail(new List<string> { "Field key required" });

        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);

        if (!mongoData.Fields.ContainsKey(payload.Key))
        {
            var noop = SaveNoOp(groupId, character);
            noop.Success = true;
            noop.StatusCode = 200;
            noop.FieldKey = payload.Key;
            return noop;
        }

        var oldValue = mongoData.Fields[payload.Key].Value;
        mongoData.Fields.Remove(payload.Key);

        var result = Save(groupId, character, mongoData);
        result.FieldKey = payload.Key;
        result.OldValue = oldValue;
        result.NewValue = 0;
        result.Changed = true;
        return result;
    }

    private CommandResult Apply(int groupId, int characterId, CommandPayload payload, bool add)
    {
        if (string.IsNullOrEmpty(payload.Key))
            return CommandResult.Fail(new List<string> { "Field key required" });

        var character = _characters.GetCharacter(groupId, characterId);
        if (character == null) return CommandResult.NotFound();

        var template = _characters.GetTemplate(groupId, character.TemplateId);
        if (template == null) return CommandResult.NotFound();

        var mongoData = _characters.BuildMongoData(character);

        int oldValue = 0;
        FieldMongoData? field = null;

        if (mongoData.Fields.ContainsKey(payload.Key))
        {
            oldValue = mongoData.Fields[payload.Key].Value;
            field = mongoData.Fields[payload.Key];
        }
        else if (template.Fields.ContainsKey(payload.Key))
        {
            oldValue = template.Fields[payload.Key].Value;
            field = CloneField(template.Fields[payload.Key]);
            mongoData.Fields[payload.Key] = field;
        }
        else if (add)
        {
            if (payload.Field == null || string.IsNullOrEmpty(payload.Field.Value.Name))
                return CommandResult.Fail(new List<string>
                { $"Can't create field with key '{payload.Key}': name and description must be not null" });
            field = BuildField(payload.Field.Value);
            mongoData.Fields[payload.Key] = field;
        }
        else
        {
            return CommandResult.Fail(new List<string> { $"Field with key '{payload.Key}' does not exist" });
        }

        ApplyFieldData(field, payload);
        var newValue = field!.Value;

        var result = Save(groupId, character, mongoData);
        result.FieldKey = payload.Key;
        result.OldValue = oldValue;
        result.NewValue = newValue;
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

    private CommandResult SaveNoOp(int groupId, Character character)
    {
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

    private static void ApplyFieldData(FieldMongoData target, CommandPayload? payload)
    {
        if (payload == null || payload.Value.Field == null) return;
        var d = payload.Value.Field.Value;
        if (d.Name != null) target.Name = d.Name;
        if (d.Description != null) target.Description = d.Description;
        if (d.Value != null) target.Value = d.Value.Value;
        if (d.MaxValue != null && target is PropertyMongoData prop) prop.MaxValue = d.MaxValue.Value;
        if (!string.IsNullOrEmpty(d.Formula)) target.Formula = d.Formula;
    }
}
