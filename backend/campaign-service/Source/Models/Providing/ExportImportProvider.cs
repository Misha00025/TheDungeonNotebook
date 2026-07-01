using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.Schemas.Templates;

namespace Tdn.Models.Providing;

public class ExportImportProvider
{
    private readonly EntityContext _entityContext;
    private readonly ItemsContext _itemsContext;
    private readonly SkillsContext _skillsContext;
    private readonly MongoDbContext _mongo;
    private readonly SchemasMongoDbContext _schemasMongo;
    private readonly AttributesProvider _attributesProvider;
    private readonly CharacterTemplateSchemaProvider _schemaProvider;
    private readonly GroupAccessHelper _accessHelper;
    private readonly ILogger<ExportImportProvider> _logger;

    public ExportImportProvider(
        EntityContext entityContext,
        ItemsContext itemsContext,
        SkillsContext skillsContext,
        MongoDbContext mongo,
        SchemasMongoDbContext schemasMongo,
        AttributesProvider attributesProvider,
        CharacterTemplateSchemaProvider schemaProvider,
        GroupAccessHelper accessHelper,
        ILogger<ExportImportProvider> logger)
    {
        _entityContext = entityContext;
        _itemsContext = itemsContext;
        _skillsContext = skillsContext;
        _mongo = mongo;
        _schemasMongo = schemasMongo;
        _attributesProvider = attributesProvider;
        _schemaProvider = schemaProvider;
        _accessHelper = accessHelper;
        _logger = logger;
    }

    public ExportData BuildExport(int groupId, HashSet<string> include)
    {
        var export = new ExportData
        {
            Version = ExportImportConstants.CurrentVersion,
            ExportedAt = DateTime.UtcNow.ToString("o"),
            GroupId = groupId
        };

        if (include.Contains("templates"))
            ExportTemplates(groupId, export);

        if (include.Contains("characters"))
            ExportCharacters(groupId, export);

        if (include.Contains("items"))
            ExportItems(groupId, export);

        if (include.Contains("skills"))
            ExportSkills(groupId, export);

        return export;
    }

    private void ExportTemplates(int groupId, ExportData export)
    {
        var schema = _schemaProvider.GetSchema(groupId);
        if (schema != null)
        {
            export.TemplateSchema = new TemplateSchemaExportData
            {
                Categories = schema.Categories.Select(c => MapCategorySchema(c)).ToList()
            };
        }

        var charlistDataSet = _entityContext.Set<CharlistData>();
        var charlists = charlistDataSet.Where(e => e.GroupId == groupId).ToList();
        if (charlists.Any())
        {
            export.Charlists = charlists.Select(cd =>
            {
                var mongoData = _mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, cd.UUID);
                return new CharlistExportData
                {
                    OldId = cd.Id,
                    Name = mongoData?.Name ?? "",
                    Description = mongoData?.Description ?? "",
                    Fields = mongoData?.Fields.ToDictionary(f => f.Key, f => MapField(f.Value)) ?? new()
                };
            }).ToList();
        }
    }

    private void ExportCharacters(int groupId, ExportData export)
    {
        var characterDataSet = _entityContext.Set<CharacterData>();
        var characters = characterDataSet.Where(e => e.GroupId == groupId).ToList();
        if (!characters.Any()) return;

        var charItemSet = _itemsContext.CharacterItems;
        var allCharItems = charItemSet.Where(ci => characters.Select(c => c.Id).Contains(ci.CharacterId)).ToList();

        export.Characters = characters.Select(cd =>
        {
            var mongoData = _mongo.GetEntity<CharacterMongoData>(MongoCollections.Characters, cd.UUID);
            var charItems = allCharItems.Where(ci => ci.CharacterId == cd.Id).ToList();

            return new CharacterExportData
            {
                OldId = cd.Id,
                Name = mongoData?.Name ?? "",
                Description = mongoData?.Description ?? "",
                TemplateOldId = cd.TemplateId,
                OwnerId = cd.OwnerId,
                Fields = mongoData?.Fields.ToDictionary(f => f.Key, f => MapField(f.Value)) ?? new()
            };
        }).ToList();

        if (allCharItems.Any())
        {
            export.CharacterItems = allCharItems.Select(ci => new CharacterItemLinkExportData
            {
                CharacterOldId = ci.CharacterId,
                ItemOldId = ci.ItemId,
                Amount = ci.Amount
            }).ToList();
        }
    }

    private void ExportItems(int groupId, ExportData export)
    {
        var itemsDataSet = _itemsContext.Items;
        var items = itemsDataSet.Where(e => e.GroupId == groupId).ToList();
        if (!items.Any()) return;

        export.Items = items.Select(id =>
        {
            var mongoData = _mongo.GetEntity<ItemMongoData>(MongoCollections.Items, id.UUID);
            return new ItemExportData
            {
                OldId = id.Id,
                Name = mongoData?.Name ?? "",
                Description = mongoData?.Description ?? "",
                Price = mongoData?.Price ?? 0,
                IsSecret = mongoData?.IsSecret ?? false,
                ImageLink = mongoData?.Image,
                Attributes = mongoData?.Attributes.Select(a => new ValuedAttributeExportData
                {
                    Key = a.Key,
                    Value = a.Value
                }).ToList() ?? new()
            };
        }).ToList();
    }

    private void ExportSkills(int groupId, ExportData export)
    {
        var skillsDataSet = _skillsContext.Skills;
        var skills = skillsDataSet.Where(e => e.GroupId == groupId).ToList();
        if (skills.Any())
        {
            export.Skills = skills.Select(sd =>
            {
                var mongoData = _mongo.GetEntity<SkillMongoData>(MongoCollections.Skills, sd.UUID);
                return new SkillExportData
                {
                    OldId = sd.Id,
                    Name = mongoData?.Name ?? "",
                    Description = mongoData?.Description ?? "",
                    IsSecret = mongoData?.IsSecret ?? false,
                    Attributes = mongoData?.Attributes.Select(a => new ValuedAttributeExportData
                    {
                        Key = a.Key,
                        Value = a.Value
                    }).ToList() ?? new()
                };
            }).ToList();
        }

        var charSkillSet = _skillsContext.CharacterSkills;
        var allCharSkills = charSkillSet.Where(cs => skills.Select(s => s.Id).Contains(cs.SkillId)).ToList();
        if (allCharSkills.Any())
        {
            export.CharacterSkills = allCharSkills.Select(cs => new CharacterSkillLinkExportData
            {
                CharacterOldId = cs.CharacterId,
                SkillOldId = cs.SkillId
            }).ToList();
        }

        var attrs = _attributesProvider.GetAttributes(groupId);
        if (attrs.Any())
        {
            export.SkillAttributes = new SkillAttributesExportData
            {
                Attributes = attrs.Select(a => new AttributeDefinitionExportData
                {
                    Key = a.Key,
                    Name = a.Name,
                    Description = a.Description,
                    IsFiltered = a.IsFiltered,
                    KnownValues = a.KnownValues.ToList()
                }).ToList()
            };
        }
    }

    public ImportResult Import(int groupId, ExportData data, HashSet<string> include)
    {
        var result = new ImportResult();
        var errors = new List<string>();

        if (data.Version != ExportImportConstants.CurrentVersion)
        {
            errors.Add($"Unsupported export version: {data.Version}. Expected: {ExportImportConstants.CurrentVersion}");
            result.Errors = errors;
            return result;
        }

        var templateOldToNew = new Dictionary<int, int>();
        var itemOldToNew = new Dictionary<int, int>();
        var skillOldToNew = new Dictionary<int, int>();
        var charOldToNew = new Dictionary<int, int>();

        try
        {
            if (include.Contains("templates"))
            {
                ImportTemplateSchema(groupId, data);
                ImportCharlists(groupId, data, templateOldToNew);
                result.Imported["templates"] = data.Charlists?.Count ?? 0;
            }

            if (include.Contains("skills"))
            {
                ImportSkillAttributes(groupId, data);
                ImportSkills(groupId, data, skillOldToNew);
                result.Imported["skills"] = data.Skills?.Count ?? 0;
            }

            if (include.Contains("items"))
            {
                ImportItems(groupId, data, itemOldToNew);
                result.Imported["items"] = data.Items?.Count ?? 0;
            }

            if (include.Contains("characters"))
            {
                ImportCharacters(groupId, data, templateOldToNew, charOldToNew);
                result.Imported["characters"] = data.Characters?.Count ?? 0;
            }

            if (include.Contains("characters") && include.Contains("items"))
            {
                ImportCharacterItemLinks(data, charOldToNew, itemOldToNew);
            }
            if (include.Contains("characters") && include.Contains("skills"))
            {
                ImportCharacterSkillLinks(data, charOldToNew, skillOldToNew);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Import failed for group {GroupId}", groupId);
            errors.Add($"Import failed: {ex.Message}");
        }

        result.Errors = errors;
        return result;
    }

    private void ImportTemplateSchema(int groupId, ExportData data)
    {
        if (data.TemplateSchema == null) return;

        var postData = new TemplateSchemaPostData
        {
            Categories = data.TemplateSchema.Categories.Select(c => MapCategoryPostData(c)).ToList()
        };
        _schemaProvider.TrySaveSchema(groupId, postData);
    }

    private void ImportCharlists(int groupId, ExportData data, Dictionary<int, int> oldToNew)
    {
        if (data.Charlists == null || !data.Charlists.Any()) return;

        var charlistSet = _entityContext.Set<CharlistData>();
        var collection = _mongo.GetCollection<CharlistMongoData>(MongoCollections.Templates);

        foreach (var ch in data.Charlists)
        {
            var mongoItem = new CharlistMongoData
            {
                Name = ch.Name,
                Description = ch.Description,
                Fields = ch.Fields.ToDictionary(f => f.Key, f => CreateFieldMongoData(f.Value))
            };

            collection.InsertOne(mongoItem);

            var sqlData = new CharlistData
            {
                UUID = mongoItem.Id.ToString(),
                GroupId = groupId
            };
            charlistSet.Add(sqlData);
            _entityContext.SaveChanges();

            oldToNew[ch.OldId] = sqlData.Id;
        }
    }

    private void ImportItems(int groupId, ExportData data, Dictionary<int, int> oldToNew)
    {
        if (data.Items == null || !data.Items.Any()) return;

        var itemSet = _itemsContext.Items;
        var collection = _mongo.GetCollection<ItemMongoData>(MongoCollections.Items);

        foreach (var item in data.Items)
        {
            var mongoItem = new ItemMongoData
            {
                Name = item.Name,
                Description = item.Description,
                Price = item.Price,
                IsSecret = item.IsSecret,
                Image = item.ImageLink,
                Attributes = item.Attributes.Select(a => new ValuedAttributeMongoData
                {
                    Key = a.Key,
                    Value = a.Value
                }).ToList()
            };

            collection.InsertOne(mongoItem);

            var sqlData = new ItemData
            {
                UUID = mongoItem.Id.ToString(),
                GroupId = groupId
            };
            itemSet.Add(sqlData);
            _itemsContext.SaveChanges();

            oldToNew[item.OldId] = sqlData.Id;
        }
    }

    private void ImportSkills(int groupId, ExportData data, Dictionary<int, int> oldToNew)
    {
        if (data.Skills == null || !data.Skills.Any()) return;

        var skillSet = _skillsContext.Skills;
        var collection = _mongo.GetCollection<SkillMongoData>(MongoCollections.Skills);

        foreach (var skill in data.Skills)
        {
            var mongoItem = new SkillMongoData
            {
                Name = skill.Name,
                Description = skill.Description,
                IsSecret = skill.IsSecret,
                Attributes = skill.Attributes.Select(a => new ValuedAttributeMongoData
                {
                    Key = a.Key,
                    Value = a.Value
                }).ToList()
            };

            collection.InsertOne(mongoItem);

            var sqlData = new SkillData
            {
                UUID = mongoItem.Id.ToString(),
                GroupId = groupId
            };
            skillSet.Add(sqlData);
            _skillsContext.SaveChanges();

            oldToNew[skill.OldId] = sqlData.Id;
        }
    }

    private void ImportCharacters(int groupId, ExportData data, Dictionary<int, int> templateOldToNew, Dictionary<int, int> charOldToNew)
    {
        if (data.Characters == null || !data.Characters.Any()) return;

        var charSet = _entityContext.Set<CharacterData>();
        var collection = _mongo.GetCollection<CharacterMongoData>(MongoCollections.Characters);

        foreach (var ch in data.Characters)
        {
            var mongoItem = new CharacterMongoData
            {
                Name = ch.Name,
                Description = ch.Description,
                Fields = ch.Fields.ToDictionary(f => f.Key, f => CreateFieldMongoData(f.Value))
            };

            collection.InsertOne(mongoItem);

            int? templateId = ch.TemplateOldId != null && templateOldToNew.ContainsKey(ch.TemplateOldId.Value)
                ? templateOldToNew[ch.TemplateOldId.Value]
                : null;

            var sqlData = new CharacterData
            {
                UUID = mongoItem.Id.ToString(),
                GroupId = groupId,
                TemplateId = templateId ?? 0,
                OwnerId = ch.OwnerId
            };
            charSet.Add(sqlData);
            _entityContext.SaveChanges();

            charOldToNew[ch.OldId] = sqlData.Id;
        }
    }

    private void ImportSkillAttributes(int groupId, ExportData data)
    {
        if (data.SkillAttributes == null || !data.SkillAttributes.Attributes.Any()) return;

        var attrs = data.SkillAttributes.Attributes.Select(a => new Tdn.Models.Attribute
        {
            Key = a.Key,
            Name = a.Name,
            Description = a.Description,
            IsFiltered = a.IsFiltered,
            KnownValues = a.KnownValues
        });
        _attributesProvider.TrySaveAttributes(groupId, attrs);
    }

    private void ImportCharacterItemLinks(ExportData data, Dictionary<int, int> charOldToNew, Dictionary<int, int> itemOldToNew)
    {
        if (data.CharacterItems == null || !data.CharacterItems.Any()) return;

        var charItemSet = _itemsContext.CharacterItems;
        foreach (var link in data.CharacterItems)
        {
            if (!charOldToNew.ContainsKey(link.CharacterOldId) || !itemOldToNew.ContainsKey(link.ItemOldId))
                continue;

            charItemSet.Add(new CharacterItemData
            {
                CharacterId = charOldToNew[link.CharacterOldId],
                ItemId = itemOldToNew[link.ItemOldId],
                Amount = link.Amount
            });
        }
        _itemsContext.SaveChanges();
    }

    private void ImportCharacterSkillLinks(ExportData data, Dictionary<int, int> charOldToNew, Dictionary<int, int> skillOldToNew)
    {
        if (data.CharacterSkills == null || !data.CharacterSkills.Any()) return;

        var charSkillSet = _skillsContext.CharacterSkills;
        foreach (var link in data.CharacterSkills)
        {
            if (!charOldToNew.ContainsKey(link.CharacterOldId) || !skillOldToNew.ContainsKey(link.SkillOldId))
                continue;

            charSkillSet.Add(new CharacterSkillData
            {
                CharacterId = charOldToNew[link.CharacterOldId],
                SkillId = skillOldToNew[link.SkillOldId]
            });
        }
        _skillsContext.SaveChanges();
    }

    private static CategorySchemaExportData MapCategorySchema(CategorySchemaMongoData cat)
    {
        return new CategorySchemaExportData
        {
            Name = cat.Name,
            Fields = cat.Fields.ToList(),
            Key = cat.Key,
            Categories = cat.Categories?.Select(MapCategorySchema).ToList()
        };
    }

    private static CategorySchemaPostData MapCategoryPostData(CategorySchemaExportData cat)
    {
        return new CategorySchemaPostData
        {
            Name = cat.Name,
            Fields = cat.Fields.ToList(),
            Categories = cat.Categories?.Select(MapCategoryPostData).ToList()
        };
    }

    private static FieldExportData MapField(FieldMongoData field)
    {
        var result = new FieldExportData
        {
            Name = field.Name,
            Description = field.Description,
            Value = field.Value,
            Formula = field.Formula
        };

        if (field is PropertyMongoData prop)
            result.MaxValue = prop.MaxValue;
        else if (field is ModifiedFieldMongoData mod)
            result.ModifierFormula = mod.ModifierFormula;

        return result;
    }

    private static FieldMongoData CreateFieldMongoData(FieldExportData data)
    {
        FieldMongoData field;
        if (data.MaxValue != null)
            field = new PropertyMongoData { MaxValue = data.MaxValue.Value };
        else if (!string.IsNullOrEmpty(data.ModifierFormula))
            field = new ModifiedFieldMongoData { ModifierFormula = data.ModifierFormula };
        else
            field = new FieldMongoData();

        field.Name = data.Name;
        field.Description = data.Description;
        field.Value = data.Value;
        field.Formula = string.IsNullOrEmpty(data.Formula) ? "" : data.Formula;

        return field;
    }
}
