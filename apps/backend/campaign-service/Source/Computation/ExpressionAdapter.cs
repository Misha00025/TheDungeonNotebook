using System.Globalization;
using NCalc;
using NCalc.Handlers;
using NCalc.Helpers;

namespace Tdn.Campaigns.Computation;

public sealed class PreparedExpression
{
    private readonly Expression expression;

    internal PreparedExpression(Expression expression, IReadOnlyCollection<string> parameterNames)
    {
        this.expression = expression;
        ParameterNames = parameterNames;
    }

    public IReadOnlyCollection<string> ParameterNames { get; }

    public object? Evaluate(Func<string, object?> resolver)
    {
        EvaluateParameterHandler resolve = (name, args) => args.Result = resolver(name);
        expression.EvaluateParameter += resolve;
        try
        {
            return expression.Evaluate();
        }
        finally
        {
            expression.EvaluateParameter -= resolve;
        }
    }
}

public static class ExpressionAdapter
{
    public static PreparedExpression Prepare(string text)
    {
        var normalized = text.Trim();
        if (normalized.Length >= 2 && normalized[0] == '{' && normalized[^1] == '}')
            normalized = normalized[1..^1];
        var configuration = new ExpressionConfiguration
        {
            CacheEnabled = false,
            Evaluation = new ExpressionEvaluationOptions
            {
                IgnoreCaseAtBuiltInFunctions = true,
                NoStringTypeCoercion = true,
                ArithmeticNullOrEmptyStringAsZero = false,
                Math = new MathOptions { AllowBooleanCalculation = false, OverflowProtection = true }
            }
        };
        var expression = new Expression(normalized, configuration: configuration, cultureInfo: CultureInfo.InvariantCulture);
        return new PreparedExpression(expression, expression.GetParameterNames().ToArray());
    }
}
