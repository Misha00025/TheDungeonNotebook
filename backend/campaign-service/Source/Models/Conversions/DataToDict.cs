using Tdn.Db.Entities;

namespace Tdn.Models.Conversions;

public static class DataToDictExtensions
{    
    public static Dictionary<string, object?> ToDict(this GroupData data)
    {
        return new()
        {
            {"id", data.Id},
            {"name", data.Name},
            {"icon", data.Icon},
        };
    }
    
    public static Dictionary<string, object?> ToDict(this Dictionary<string, FieldMongoData> fields)
    {
        var result = new Dictionary<string, object?>();
        foreach (var name in fields.Keys)
        {
            var field = fields[name];
            var addedField = new Dictionary<string, object?>()
            {
                {"name", field.Name},
                {"description", field.Description}
            };
            if (field.Category != null)
                addedField.Add("category", field.Category);
            if (!string.IsNullOrEmpty(field.Formula))
                addedField.Add("formula", field.Formula);
            if (field is PropertyMongoData)
            {
                addedField.Add("maxValue", field.CalculatedValue == null || string.IsNullOrEmpty(field.Formula) ? (field as PropertyMongoData)?.MaxValue : field.CalculatedValue);
                addedField.Add("value", field.Value);
            }
            else if (field is ModifiedFieldMongoData)
            {
                addedField.Add("modifier", (field as ModifiedFieldMongoData)?.Modifier);
                addedField.Add("modifierFormula", (field as ModifiedFieldMongoData)?.ModifierFormula);
                addedField.Add("value", field.Value);
            }
            else
            {
                addedField.Add("value", field.CalculatedValue == null ? field.Value : field.CalculatedValue);
            }
            // addedField.Add("calculated", field.CalculatedValue);
            result.Add(name, addedField);
        }
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this GroupEntityData data, GroupEntityMongoData? groupEntity)
    {
        return new()
        {
            {"id", data.Id},
            {"group", data.Group != null ? data.Group.ToDict() : new GroupData(){Id = data.GroupId}.ToDict()},
            {"name", groupEntity?.Name},
            {"description", groupEntity?.Description},
        };
    }
    
    public static object ToDict(this CategorySchema data)
    {
        return new
        {
            fields = data.Fields,
            name = data.Name,
            key = data.Key,
            categories = data.Categories?.Select(e => e.ToDict()).ToList()
        };
    }
    
    public static Dictionary<string, object?> ToDict(this GroupEntityData data, CharlistMongoData? mongoData)
    {
        var result = data.ToDict(mongoData as GroupEntityMongoData);
        result.Add("fields", mongoData?.Fields.ToDict());
        if (mongoData?.Schema != null)
            result.Add("schema", new { categories = mongoData?.Schema.Categories.Select(e => e.ToDict()).ToList() });
        else
            result.Add("schema", new { });
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this GroupEntityData data, ItemMongoData? mongoData)
    {
        var result = data.ToDict(mongoData as GroupEntityMongoData);
        result.Add("price", mongoData?.Price);
        result.Add("image_link", mongoData?.Image);
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this CharacterData data, CharacterMongoData? mongoData)
    {
        var result = data.ToDict(mongoData as CharlistMongoData);
        result.Add("templateId", data.TemplateId);
        return result;
    }
    
    public static Dictionary<string, object?> ToDict(this AmountedItemMongoData data, int index)
    {
        return new Dictionary<string, object?>()
        {
            {"id", index},
            {"name", data.Name},
            {"description", data.Description},
            {"price", data.Price},
            {"amount", data.Amount},
            {"image_link", data.Image}
        };
    }
    
    public static List<Dictionary<string, object?>> ToDict(this List<AmountedItemMongoData> dataList, int startIndex = -1)
    {
        int index = startIndex;
        return dataList.Select(e => e.ToDict(index--)).ToList();
    }
}