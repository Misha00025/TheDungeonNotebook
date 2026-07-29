using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.Processing;
using Tdn.Models.DTOs;

namespace Tdn.Models.Providing;

public class CharactersProvider : DualDbRepository<Character, CharacterData, CharacterMongoData>
{
    public CharactersProvider(CampaignContext context, IMongoDbContext mongoDbContext, ILogger<CharactersProvider> logger)
        : base(context, mongoDbContext, logger) { }

    protected override string CollectionName => "characters";
    protected override Expression<Func<CharacterData, bool>> GroupFilter(int groupId) => e => e.GroupId == groupId;
    protected override Expression<Func<CharacterData, bool>> IdFilter(int groupId, int entityId) => e => e.GroupId == groupId && e.Id == entityId;
    protected override int GetGroupId(Character entity) => entity.GroupId;
    protected override int GetEntityId(Character entity) => entity.Id;
    protected override void SetEntityId(Character entity, int id) => entity.Id = id;

    protected override Character ToDomain(CharacterData sqlData, CharacterMongoData mongoData) => new Character
    {
        Id = sqlData.Id,
        GroupId = sqlData.GroupId,
        TemplateId = sqlData.TemplateId,
        OwnerId = sqlData.OwnerId,
        Name = mongoData.Name,
        Description = mongoData.Description,
        Fields = mongoData.Fields,
        Items = mongoData.Items,
        Equipment = mongoData.Equipment,
    };

    protected override CharacterMongoData ToMongoData(Character entity) => new CharacterMongoData
    {
        Name = entity.Name,
        Description = entity.Description,
        Fields = entity.Fields,
        Items = entity.Items,
        Equipment = entity.Equipment,
    };

    public Character? GetCharacter(int groupId, int characterId) => Get(groupId, characterId);
    public IEnumerable<Character> GetCharacters(int groupId) => GetByGroup(groupId);

    public bool TryCreateCharacter(int groupId, Character character)
    {
        try
        {
            var mongoData = ToMongoData(character);
            Mongo.GetCollection<CharacterMongoData>(CollectionName).InsertOne(mongoData);
            var sqlData = new CharacterData
            {
                GroupId = groupId,
                TemplateId = character.TemplateId,
                OwnerId = character.OwnerId,
                UUID = mongoData.Id.ToString()
            };
            Db.Set<CharacterData>().Add(sqlData);
            Db.SaveChanges();
            character.Id = sqlData.Id;
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error creating character: {e}");
            return false;
        }
    }

    public bool TryUpdateCharacter(Character character)
    {
        try
        {
            var sqlData = Db.Set<CharacterData>()
                .FirstOrDefault(IdFilter(character.GroupId, character.Id));
            if (sqlData == null)
                return false;

            var mongoData = ToMongoData(character);
            mongoData.Id = new ObjectId(sqlData.UUID);

            var result = Mongo.GetCollection<CharacterMongoData>(CollectionName)
                .ReplaceOne(
                    Builders<CharacterMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)),
                    mongoData);
            return result.IsAcknowledged && result.ModifiedCount > 0;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error updating character: {e}");
            return false;
        }
    }

    public bool TryUpdateOwnerId(int groupId, int characterId, int? ownerId)
    {
        var sqlData = Db.Set<CharacterData>().FirstOrDefault(e => e.Id == characterId && e.GroupId == groupId);
        if (sqlData == null) return false;
        sqlData.OwnerId = ownerId;
        Db.SaveChanges();
        return true;
    }

    public bool TryDeleteCharacter(int groupId, int characterId)
    {
        try
        {
            var sqlData = Db.Set<CharacterData>().FirstOrDefault(IdFilter(groupId, characterId));
            if (sqlData == null)
                return false;
            Mongo.GetCollection<CharacterMongoData>(CollectionName)
                .DeleteOne(Builders<CharacterMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)));
            Db.Set<CharacterData>().Remove(sqlData);
            Db.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error deleting character: {e}");
            return false;
        }
    }

    public CharacterData? GetCharacterSqlData(int groupId, int characterId)
    {
        return Db.Set<CharacterData>().FirstOrDefault(cd => cd.Id == characterId && cd.GroupId == groupId);
    }

    public TemplateMongoData? GetTemplate(int groupId, int templateId)
    {
        var templateData = Db.Set<TemplateData>()
            .Where(e => e.GroupId == groupId && e.Id == templateId)
            .FirstOrDefault();
        if (templateData == null) return null;
        return Mongo.GetEntity<TemplateMongoData>(MongoCollections.Templates, templateData.UUID);
    }

    public CharacterMongoData BuildMongoData(Character c) => new CharacterMongoData
    {
        Name = c.Name,
        Description = c.Description,
        Fields = c.Fields,
        Items = c.Items,
        Equipment = c.Equipment,
    };

    public CharacterMongoData AsCharacterWithTemplate(Character character, int groupId)
    {
        var template = GetTemplate(character.GroupId, character.TemplateId);
        var mongoData = BuildMongoData(character);
        if (template == null)
            return mongoData;
        return mongoData.CompareWith(template);
    }

    private static bool TryChangeProperties(CharacterMongoData character, CharacterPatchData data)
    {
        var ok = data.Name != null || data.Description != null;
        if (data.Name != null)
            character.Name = data.Name;
        if (data.Description != null)
            character.Description = data.Description;
        return ok;
    }

    private static bool TryChangeFields(CharacterMongoData character, TemplateMongoData template, CharacterPatchData data, out List<string> errors)
    {
        var doSomething = false;
        errors = new();
        if (data.Fields == null || data.Fields.Count == 0)
            return false;
        foreach (var field in data.Fields)
        {
            var tmp = field.Value;
            var isExist = character.Fields.ContainsKey(field.Key);
            if (isExist)
            {
                if (tmp == null)
                {
                    character.Fields.Remove(field.Key);
                    doSomething = true;
                }
                else
                {
                    var value = (FieldPatchData)tmp;
                    if (value.Name == null && value.Description == null && value.Value == null && value.MaxValue == null && value.Formula == null)
                        continue;
                    FieldMongoData existField = character.Fields[field.Key];
                    if (value.MaxValue != null && existField is PropertyMongoData)
                        ((PropertyMongoData)existField).MaxValue = (int)value.MaxValue;
                    existField.Name = value.Name != null ? value.Name : existField.Name;
                    existField.Description = value.Description != null ? value.Description : existField.Description;
                    existField.Value = value.Value != null ? (int)value.Value : existField.Value;
                    existField.Formula = value.Formula != null ? value.Formula : existField.Formula;
                    doSomething = true;
                }
            }
            else
            {
                if (tmp == null)
                {
                    errors.Add($"Can't delete field with key '{field.Key}': this field does not exist or set as default");
                    continue;
                }
                var value = (FieldPatchData)tmp;
                var isDefaultField = template.Fields.ContainsKey(field.Key);
                if (isDefaultField)
                {
                    var newField = template.Fields[field.Key];
                    if (value.MaxValue != null && newField is PropertyMongoData)
                        ((PropertyMongoData)newField).MaxValue = (int)value.MaxValue;
                    newField.Value = value.Value != null ? (int)value.Value : newField.Value;
                    newField.Formula = value.Formula != null ? value.Formula : newField.Formula;
                    character.Fields.Add(field.Key, newField);
                }
                else
                {
                    errors.Add($"Can't create field with key '{field.Key}': name and description must be not null");
                    continue;
                }
                doSomething = true;
            }
        }
        return doSomething;
    }

    public PatchCharacterResult PatchCharacter(
        int groupId,
        int characterId,
        CharacterPatchData data,
        bool withEmptyFields = true)
    {
        var character = GetCharacter(groupId, characterId);
        if (character == null)
            return new PatchCharacterResult { Success = false, StatusCode = 404 };

        var mongoData = BuildMongoData(character);
        var anythingChanged = TryChangeProperties(mongoData, data);

        var template = GetTemplate(groupId, character.TemplateId);
        if (template == null)
            return new PatchCharacterResult { Success = false, StatusCode = 404, Data = null };

        var oldFieldValues = new Dictionary<string, int>();
        if (data.Fields != null)
        {
            foreach (var field in data.Fields)
            {
                if (field.Value?.Value == null) continue;
                if (mongoData.Fields.ContainsKey(field.Key))
                    oldFieldValues[field.Key] = mongoData.Fields[field.Key].Value;
                else if (template.Fields.ContainsKey(field.Key))
                    oldFieldValues[field.Key] = template.Fields[field.Key].Value;
            }
        }

        var fieldsChanged = TryChangeFields(mongoData, template, data, out var errors);
        anythingChanged = (anythingChanged && data.Fields == null) || fieldsChanged;

        if (anythingChanged)
        {
            character.Name = mongoData.Name;
            character.Description = mongoData.Description;
            character.Fields = mongoData.Fields;
            character.Items = mongoData.Items;
            character.Equipment = mongoData.Equipment;

            TryUpdateCharacter(character);

            if (withEmptyFields)
            {
                var mongoDataWithTemplate = AsCharacterWithTemplate(character, groupId);
                FormulaCalculator.CalculateFields(mongoDataWithTemplate);
                var sqlData = GetCharacterSqlData(groupId, characterId);
                var result = sqlData!.ToDict(mongoDataWithTemplate);
                if (errors.Count > 0)
                    result.Add("errors", errors);
                return new PatchCharacterResult { Success = true, Data = result, OldFieldValues = oldFieldValues };
            }
            else
            {
                FormulaCalculator.CalculateFields(mongoData);
                var sqlData = GetCharacterSqlData(groupId, characterId);
                var result = sqlData!.ToDict(mongoData);
                if (errors.Count > 0)
                    result.Add("errors", errors);
                return new PatchCharacterResult { Success = true, Data = result, OldFieldValues = oldFieldValues };
            }
        }
        else if (errors.Count > 0)
            return new PatchCharacterResult { Success = false, StatusCode = 400, Errors = errors };
        else
            return new PatchCharacterResult { Success = false, StatusCode = 400 };
    }
}
