using Tdn.Db.Entities;

namespace Tdn.Models.Conversions;

public static class CharlistsComparingExtensions
{
    public static CharlistMongoData Copy(this CharlistMongoData data) => new CharlistMongoData()
    {
        Name = data.Name,
        Description = data.Description,
        Fields = data.Fields,
    };

    public static PropertyMongoData AsProperty(this FieldMongoData field, int MaxValue = 0) => new PropertyMongoData()
    {
        Name = field.Name,
        Description = field.Description,
        Value = field.Value,
        Formula = field.Formula,
        MaxValue = MaxValue
    };


    public static ModifiedFieldMongoData AsModifier(this FieldMongoData field, string formula) => new ModifiedFieldMongoData()
    {
        Name = field.Name,
        Description = field.Description,
        Value = field.Value,
        Formula = field.Formula,
        ModifierFormula = formula
    };
    

    private static FieldMongoData CompareWith(this FieldMongoData field, FieldMongoData source)
    {
        if (source is PropertyMongoData && !(field is PropertyMongoData))
            field = field.AsProperty(((PropertyMongoData)source).MaxValue);
        if (source is ModifiedFieldMongoData)
            field = field.AsModifier(((ModifiedFieldMongoData)source).ModifierFormula);
        field.Name = source.Name;
        field.Description = source.Description;
        field.Formula = string.IsNullOrEmpty(field.Formula) ? source.Formula : field.Formula;
        return field;
    }
         
    public static void CompareWith(this CharlistMongoData data, CharlistMongoData source)
    {
        var result = data;
        foreach (var field in source.Fields)
        {
            if (result.Fields.ContainsKey(field.Key))
            {
                var charField = result.Fields[field.Key];
                charField = charField.CompareWith(field.Value);
                result.Fields[field.Key] = charField;
            }
            else
            {
                result.Fields.Add(field.Key, field.Value);
            }
        }
    }

    public static CharacterMongoData CompareWith(this CharacterMongoData data, CharlistMongoData source)
    {
        ((CharlistMongoData)data).CompareWith(source);
        return data;
    }
}