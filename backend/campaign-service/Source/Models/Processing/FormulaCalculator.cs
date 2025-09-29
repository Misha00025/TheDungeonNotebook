using System.Data;
using System.Text.RegularExpressions;
using Tdn.Db.Entities;

namespace Tdn.Models.Processing;


public static class FormulaCalculator
{
    private static readonly Dictionary<string, Func<double[], double>> MathFunctions =
        new Dictionary<string, Func<double[], double>>(StringComparer.OrdinalIgnoreCase)
    {
        {"abs", args => Math.Abs(args[0])},
        {"sin", args => Math.Sin(args[0])},
        {"cos", args => Math.Cos(args[0])},
        {"tan", args => Math.Tan(args[0])},
        {"sqrt", args => Math.Sqrt(args[0])},
        {"pow", args => Math.Pow(args[0], args[1])},
        {"min", args => Math.Min(args[0], args[1])},
        {"max", args => Math.Max(args[0], args[1])},
        {"round", args => (int)Math.Round(args[0])},
        {"floor", args => (int)Math.Floor(args[0])},
        {"ceiling", args => (int)Math.Ceiling(args[0])},
        {"pi", args => Math.PI},
        {"e", args => Math.E},
    };

    public static void CalculateFields(CharlistMongoData charlist)
    {
        var fields = charlist.Fields;
        var computed = new HashSet<string>();
        var unresolved = new List<string>();
        
        // Сначала устанавливаем CalculatedValue для полей без формул
        foreach (var (key, field) in fields)
        {
            if (string.IsNullOrEmpty(field.Formula))
            {
                field.CalculatedValue = field.Value;
                computed.Add(key);
            }
        }

        // Основной цикл расчета полей с формулами
        bool changed;
        do
        {
            changed = false;
            unresolved.Clear();

            foreach (var (key, field) in fields)
            {
                if (computed.Contains(key)) continue;

                try
                {
                    if (TryCalculateField(field, fields, out int result))
                    {
                        field.CalculatedValue = result;
                        computed.Add(key);
                        changed = true;
                    }
                    else
                    {
                        unresolved.Add(key);
                    }
                }
                catch
                {
                    unresolved.Add(key);
                }
            }
        } while (changed && unresolved.Count > 0);

        // Расчет модификаторов для ModifiedFieldMongoData
        var computedModifiers = new HashSet<string>();
        var unresolvedModifiers = new List<string>();
        bool changedModifiers;
        
        do
        {
            changedModifiers = false;
            unresolvedModifiers.Clear();

            foreach (var (key, field) in fields)
            {
                if (field is not ModifiedFieldMongoData modifiedField) continue;
                if (computedModifiers.Contains(key)) continue;

                try
                {
                    if (TryCalculateModifier(modifiedField, fields, out int modifierResult))
                    {
                        modifiedField.Modifier = modifierResult;
                        computedModifiers.Add(key);
                        changedModifiers = true;
                    }
                    else
                    {
                        unresolvedModifiers.Add(key);
                    }
                }
                catch
                {
                    unresolvedModifiers.Add(key);
                }
            }
        } while (changedModifiers && unresolvedModifiers.Count > 0);

        // Установка модификатора равным CalculatedValue для невычисленных полей
        foreach (var key in unresolvedModifiers)
        {
            if (fields[key] is ModifiedFieldMongoData modifiedField)
            {
                modifiedField.Modifier = modifiedField.CalculatedValue ?? modifiedField.Value;
            }
        }
    }

    private static bool TryCalculateField(
        FieldMongoData field,
        Dictionary<string, FieldMongoData> allFields,
        out int result)
    {
        result = field.Value;
        if (string.IsNullOrEmpty(field.Formula)) return false;

        string expression = field.Formula;
        
        // Заменяем ссылки на поля и модификаторы
        var matches = Regex.Matches(expression, @":(!?\w+):");
        foreach (Match match in matches)
        {
            string fullMatch = match.Groups[1].Value;
            bool isModifier = fullMatch.StartsWith("!");
            string fieldKey = isModifier ? fullMatch.Substring(1) : fullMatch;

            if (!allFields.TryGetValue(fieldKey, out var referencedField))
                return false;

            if (isModifier)
            {
                // Ссылка на модификатор - пытаемся вычислить его на месте
                if (referencedField is ModifiedFieldMongoData modifiedReferencedField)
                {
                    // Если модификатор уже вычислен, используем его
                    if (modifiedReferencedField.Modifier != 0)
                    {
                        expression = expression.Replace(match.Value, modifiedReferencedField.Modifier.ToString());
                    }
                    else
                    {
                        // Пытаемся вычислить модификатор на месте
                        if (TryCalculateModifier(modifiedReferencedField, allFields, out int modifierValue))
                        {
                            modifiedReferencedField.Modifier = modifierValue;
                            expression = expression.Replace(match.Value, modifierValue.ToString());
                        }
                        else
                        {
                            // Не удалось вычислить модификатор - откладываем вычисление этого поля
                            return false;
                        }
                    }
                }
                else
                {
                    // Если поле не является ModifiedFieldMongoData, используем его CalculatedValue
                    if (referencedField.CalculatedValue == null)
                        return false;
                    int value = (int)referencedField.CalculatedValue;
                    expression = expression.Replace(match.Value, value.ToString());
                }
            }
            else
            {
                // Обычная ссылка на значение поля
                if (referencedField.CalculatedValue == null)
                    return false;
                int value = (int)referencedField.CalculatedValue;
                expression = expression.Replace(match.Value, value.ToString());
            }
        }
        
        try
        {
            result = EvaluateExpression(expression);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool TryCalculateModifier(
        ModifiedFieldMongoData field,
        Dictionary<string, FieldMongoData> allFields,
        out int result)
    {
        result = field.Modifier;
        if (string.IsNullOrEmpty(field.ModifierFormula)) 
        {
            // Если формула модификатора пуста, используем CalculatedValue
            result = field.CalculatedValue ?? field.Value;
            return true;
        }

        string expression = field.ModifierFormula;
        
        // Заменяем ссылки на поля, включая специальное значение :value:
        var matches = Regex.Matches(expression, @":(!?\w+):");
        foreach (Match match in matches)
        {
            string fullMatch = match.Groups[1].Value;
            bool isModifier = fullMatch.StartsWith("!");
            string fieldKey = isModifier ? fullMatch.Substring(1) : fullMatch;

            if (fieldKey == "value")
            {
                // :value: означает CalculatedValue текущего поля
                if (field.CalculatedValue == null)
                    return false;
                int value = (int)field.CalculatedValue;
                expression = expression.Replace(match.Value, value.ToString());
            }
            else
            {
                if (!allFields.TryGetValue(fieldKey, out var referencedField))
                    return false;

                if (isModifier)
                {
                    // Ссылка на модификатор - пытаемся вычислить его на месте
                    if (referencedField is ModifiedFieldMongoData modifiedReferencedField)
                    {
                        // Если модификатор уже вычислен, используем его
                        if (modifiedReferencedField.Modifier != 0)
                        {
                            expression = expression.Replace(match.Value, modifiedReferencedField.Modifier.ToString());
                        }
                        else
                        {
                            // Пытаемся вычислить модификатор на месте
                            if (TryCalculateModifier(modifiedReferencedField, allFields, out int modifierValue))
                            {
                                modifiedReferencedField.Modifier = modifierValue;
                                expression = expression.Replace(match.Value, modifierValue.ToString());
                            }
                            else
                            {
                                // Не удалось вычислить модификатор - откладываем вычисление этого модификатора
                                return false;
                            }
                        }
                    }
                    else
                    {
                        // Если поле не является ModifiedFieldMongoData, используем его CalculatedValue
                        if (referencedField.CalculatedValue == null)
                            return false;
                        int value = (int)referencedField.CalculatedValue;
                        expression = expression.Replace(match.Value, value.ToString());
                    }
                }
                else
                {
                    // Обычная ссылка на значение поля
                    if (referencedField.CalculatedValue == null)
                        return false;
                    int value = (int)referencedField.CalculatedValue;
                    expression = expression.Replace(match.Value, value.ToString());
                }
            }
        }
        
        try
        {
            result = EvaluateExpression(expression);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static int EvaluateExpression(string expression)
    {
        expression = EvaluateMathFunctions(expression);
        using DataTable table = new DataTable();
        var result = table.Compute(expression, null);
        return Convert.ToInt32(Math.Round(Convert.ToDouble(result)));
    }

    private static string EvaluateMathFunctions(string expression)
    {
        var regex = new Regex(@"([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)");
        Match match;
        
        while ((match = regex.Match(expression)).Success)
        {
            string functionName = match.Groups[1].Value;
            string argsString = match.Groups[2].Value;

            if (!MathFunctions.TryGetValue(functionName, out var function))
                throw new NotSupportedException($"Function {functionName} is not supported");

            var args = ParseArguments(argsString)
                .Select(arg => EvaluateBasicExpression(arg))
                .ToArray();
            double result = function(args);
            expression = expression.Replace(match.Value, result.ToString());
        }

        return expression;
    }

    private static IEnumerable<string> ParseArguments(string argsString)
    {
        var args = new List<string>();
        int parenLevel = 0;
        int startIndex = 0;

        for (int i = 0; i < argsString.Length; i++)
        {
            char c = argsString[i];
            
            if (c == '(') parenLevel++;
            else if (c == ')') parenLevel--;
            else if (c == ',' && parenLevel == 0)
            {
                args.Add(argsString.Substring(startIndex, i - startIndex).Trim());
                startIndex = i + 1;
            }
        }
        if (startIndex < argsString.Length)
            args.Add(argsString.Substring(startIndex).Trim());

        return args;
    }

    private static double EvaluateBasicExpression(string expression)
    {
        using DataTable table = new DataTable();
        var result = table.Compute(expression, null);
        return Convert.ToDouble(result);
    }
}