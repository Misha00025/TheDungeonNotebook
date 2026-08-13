using Tdn.Models.Processing;

namespace Tdn.Tests.Source;

public class FormulaCalculatorTests
{
    [Fact]
    public void CalculateFields_SimpleValue_NoFormula_KeepsValue()
    {
        var data = new TemplateMongoData();
        data.Fields["hp"] = new FieldMongoData { Value = 100 };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(100, data.Fields["hp"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_SimpleFormula_EvaluatesCorrectly()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 10 };
        data.Fields["total"] = new FieldMongoData { Value = 0, Formula = ":base:+5" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(15, data.Fields["total"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_NestedFieldReferences()
    {
        var data = new TemplateMongoData();
        data.Fields["str"] = new FieldMongoData { Value = 5 };
        data.Fields["bonus"] = new FieldMongoData { Value = 0, Formula = ":str:*2" };
        data.Fields["total"] = new FieldMongoData { Value = 0, Formula = ":str:+:bonus:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(15, data.Fields["total"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_WithModifier()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 10 };
        data.Fields["bonus"] = new ModifiedFieldMongoData { Value = 5, ModifierFormula = ":base:" };
        data.Fields["total"] = new FieldMongoData { Value = 0, Formula = ":base:+:!bonus:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(20, data.Fields["total"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_CircularReference_DoesNotThrow()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 0, Formula = ":b:" };
        data.Fields["b"] = new FieldMongoData { Value = 0, Formula = ":a:" };

        var exception = Record.Exception(() => FormulaCalculator.CalculateFields(data));

        Assert.Null(exception);
    }

    [Fact]
    public void CalculateFields_WithMathFunctions()
    {
        var data = new TemplateMongoData();
        data.Fields["val"] = new FieldMongoData { Value = 9 };
        data.Fields["sqrt"] = new FieldMongoData { Value = 0, Formula = "sqrt(:val:)" };
        data.Fields["abs"] = new FieldMongoData { Value = 0, Formula = "abs(-5)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(3, data.Fields["sqrt"].CalculatedValue);
        Assert.Equal(5, data.Fields["abs"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_Addition()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 7 };
        data.Fields["b"] = new FieldMongoData { Value = 3 };
        data.Fields["sum"] = new FieldMongoData { Value = 0, Formula = ":a:+:b:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(10, data.Fields["sum"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_Subtraction()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 15 };
        data.Fields["b"] = new FieldMongoData { Value = 7 };
        data.Fields["diff"] = new FieldMongoData { Value = 0, Formula = ":a:-:b:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(8, data.Fields["diff"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_Multiplication()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 6 };
        data.Fields["b"] = new FieldMongoData { Value = 7 };
        data.Fields["prod"] = new FieldMongoData { Value = 0, Formula = ":a:*:b:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(42, data.Fields["prod"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_Division()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 15 };
        data.Fields["b"] = new FieldMongoData { Value = 4 };
        data.Fields["quot"] = new FieldMongoData { Value = 0, Formula = ":a:/:b:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(4, data.Fields["quot"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_OperatorPrecedence_MultiplicationBeforeAddition()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 2 };
        data.Fields["b"] = new FieldMongoData { Value = 3 };
        data.Fields["c"] = new FieldMongoData { Value = 4 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = ":a:+:b:*:c:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(14, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_OperatorPrecedenceWithParens_OverridesDefault()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 2 };
        data.Fields["b"] = new FieldMongoData { Value = 3 };
        data.Fields["c"] = new FieldMongoData { Value = 4 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "(:a:+:b:)*:c:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(20, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_SinFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "sin(0)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(0, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_CosFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "cos(0)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(1, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_TanFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "tan(0)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(0, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_PowFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 2 };
        data.Fields["b"] = new FieldMongoData { Value = 3 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "pow(:a:, :b:)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(8, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_MinFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 5 };
        data.Fields["b"] = new FieldMongoData { Value = 12 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "min(:a:, :b:)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(5, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_MaxFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 5 };
        data.Fields["b"] = new FieldMongoData { Value = 12 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "max(:a:, :b:)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(12, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_RoundFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "round(3.7)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(4, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_FloorFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "floor(3.7)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(3, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_CeilingFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "ceiling(3.7)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(4, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_PiFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "pi()" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(3, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_EFunction()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "e()" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(3, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_DeepChain_FourLevels()
    {
        var data = new TemplateMongoData();
        data.Fields["d"] = new FieldMongoData { Value = 2 };
        data.Fields["c"] = new FieldMongoData { Value = 0, Formula = ":d:*3" };
        data.Fields["b"] = new FieldMongoData { Value = 0, Formula = ":c:+1" };
        data.Fields["a"] = new FieldMongoData { Value = 0, Formula = ":b:*2" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(6, data.Fields["c"].CalculatedValue);
        Assert.Equal(7, data.Fields["b"].CalculatedValue);
        Assert.Equal(14, data.Fields["a"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_DiamondDependency()
    {
        var data = new TemplateMongoData();
        data.Fields["d"] = new FieldMongoData { Value = 10 };
        data.Fields["b"] = new FieldMongoData { Value = 0, Formula = ":d:*2" };
        data.Fields["c"] = new FieldMongoData { Value = 0, Formula = ":d:+5" };
        data.Fields["a"] = new FieldMongoData { Value = 0, Formula = ":b:+:c:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(20, data.Fields["b"].CalculatedValue);
        Assert.Equal(15, data.Fields["c"].CalculatedValue);
        Assert.Equal(35, data.Fields["a"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_ModifierFormula_DefaultValue()
    {
        var data = new TemplateMongoData();
        data.Fields["val"] = new FieldMongoData { Value = 10 };
        data.Fields["mod"] = new ModifiedFieldMongoData { Value = 0, Formula = ":val:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(10, data.Fields["mod"].CalculatedValue);
        Assert.Equal(10, ((ModifiedFieldMongoData)data.Fields["mod"]).Modifier);
    }

    [Fact]
    public void CalculateFields_ModifierFormula_CustomFormula()
    {
        var data = new TemplateMongoData();
        data.Fields["val"] = new FieldMongoData { Value = 10 };
        data.Fields["mod"] = new ModifiedFieldMongoData { Value = 0, Formula = ":val:", ModifierFormula = ":value:*2" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(10, data.Fields["mod"].CalculatedValue);
        Assert.Equal(20, ((ModifiedFieldMongoData)data.Fields["mod"]).Modifier);
    }

    [Fact]
    public void CalculateFields_ModifierFormula_Empty_UsesCalculatedValue()
    {
        var data = new TemplateMongoData();
        data.Fields["val"] = new FieldMongoData { Value = 10 };
        data.Fields["mod"] = new ModifiedFieldMongoData { Value = 0, Formula = ":val:+5", ModifierFormula = "" };

        FormulaCalculator.CalculateFields(data);

        var mod = (ModifiedFieldMongoData)data.Fields["mod"];
        Assert.Equal(15, mod.CalculatedValue);
        Assert.Equal(15, mod.Modifier);
    }

    [Fact]
    public void CalculateFields_ModifierFormula_Empty_UsesValueWhenNoFormula()
    {
        var data = new TemplateMongoData();
        data.Fields["mod"] = new ModifiedFieldMongoData { Value = 7, ModifierFormula = "" };

        FormulaCalculator.CalculateFields(data);

        var mod = (ModifiedFieldMongoData)data.Fields["mod"];
        Assert.Equal(7, mod.CalculatedValue);
        Assert.Equal(7, mod.Modifier);
    }

    [Fact]
    public void CalculateFields_ExclamationRef_OnRegularField_UsesCalculatedValue()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 10 };
        data.Fields["total"] = new FieldMongoData { Value = 0, Formula = ":!base:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(10, data.Fields["total"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_ModifierZero_HandledCorrectly()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 0 };
        data.Fields["mod"] = new ModifiedFieldMongoData { Value = 0, Formula = ":base:", ModifierFormula = ":value:*2" };
        data.Fields["total"] = new FieldMongoData { Value = 0, Formula = ":!mod:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(0, data.Fields["total"].CalculatedValue);
        Assert.Equal(0, ((ModifiedFieldMongoData)data.Fields["mod"]).Modifier);
    }

    [Fact]
    public void CalculateFields_UnresolvedFieldInFormula_StaysUncomputed()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 5 };
        data.Fields["b"] = new FieldMongoData { Value = 0, Formula = ":nonexistent:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(5, data.Fields["a"].CalculatedValue);
        Assert.Null(data.Fields["b"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_PropertyMongoData_BehavesLikeFieldMongoData()
    {
        var data = new TemplateMongoData();
        data.Fields["hp"] = new PropertyMongoData { Value = 100, MaxValue = 150 };
        data.Fields["bonus"] = new PropertyMongoData { Value = 0, Formula = ":hp:+10", MaxValue = 200 };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(100, data.Fields["hp"].CalculatedValue);
        Assert.Equal(110, data.Fields["bonus"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_FormulaWithNegativeNumber()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 10 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = ":base: + -5" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(5, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_MixedExpression_FieldRefsAndFunctions()
    {
        var data = new TemplateMongoData();
        data.Fields["str"] = new FieldMongoData { Value = 5 };
        data.Fields["dex"] = new FieldMongoData { Value = 9 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = ":str: + floor(:dex:/2) * 2" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(13, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_DivisionByZero_DoesNotThrow()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 5 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = ":a:/0" };

        var exception = Record.Exception(() => FormulaCalculator.CalculateFields(data));

        Assert.Null(exception);
    }

    [Fact]
    public void CalculateFields_InvalidExpression_DoesNotThrow()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "!!invalid!!" };

        var exception = Record.Exception(() => FormulaCalculator.CalculateFields(data));

        Assert.Null(exception);
    }

    [Fact]
    public void CalculateFields_SeveralFields_SameFormula_AllComputed()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 10 };
        data.Fields["a"] = new FieldMongoData { Value = 0, Formula = ":base:*2" };
        data.Fields["b"] = new FieldMongoData { Value = 0, Formula = ":base:*2" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(20, data.Fields["a"].CalculatedValue);
        Assert.Equal(20, data.Fields["b"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_ModifierFormula_ReferencesOtherModifier()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 10 };
        data.Fields["bonus"] = new ModifiedFieldMongoData { Value = 0, Formula = ":base:", ModifierFormula = ":base:" };
        data.Fields["total"] = new ModifiedFieldMongoData { Value = 0, Formula = ":base:+:bonus:", ModifierFormula = ":value:+:!bonus:" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(20, data.Fields["total"].CalculatedValue);
        Assert.Equal(30, ((ModifiedFieldMongoData)data.Fields["total"]).Modifier);
    }

    [Fact]
    public void CalculateFields_MinMax_NestedExpressions()
    {
        var data = new TemplateMongoData();
        data.Fields["a"] = new FieldMongoData { Value = 3 };
        data.Fields["b"] = new FieldMongoData { Value = 10 };
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "min(:a:*2, :b:+5)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(6, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_Pow_NegativeExponent()
    {
        var data = new TemplateMongoData();
        data.Fields["result"] = new FieldMongoData { Value = 0, Formula = "pow(2, -1)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(0, data.Fields["result"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_Floor_Ceiling_Round_FractionalResults()
    {
        var data = new TemplateMongoData();
        data.Fields["floorRes"] = new FieldMongoData { Value = 0, Formula = "floor(3.7)" };
        data.Fields["ceilRes"] = new FieldMongoData { Value = 0, Formula = "ceiling(3.7)" };
        data.Fields["roundRes"] = new FieldMongoData { Value = 0, Formula = "round(3.7)" };

        FormulaCalculator.CalculateFields(data);

        Assert.Equal(3, data.Fields["floorRes"].CalculatedValue);
        Assert.Equal(4, data.Fields["ceilRes"].CalculatedValue);
        Assert.Equal(4, data.Fields["roundRes"].CalculatedValue);
    }

    [Fact]
    public void CalculateFields_CircularModifierDependency_DoesNotThrow()
    {
        var data = new TemplateMongoData();
        data.Fields["base"] = new FieldMongoData { Value = 10 };
        data.Fields["a"] = new ModifiedFieldMongoData { Value = 0, Formula = ":base:", ModifierFormula = ":!b:" };
        data.Fields["b"] = new ModifiedFieldMongoData { Value = 0, Formula = ":base:", ModifierFormula = ":!a:" };

        bool completedNormally = false;
        var thread = new Thread(() =>
        {
            try
            {
                FormulaCalculator.CalculateFields(data);
            }
            catch
            {
                // StackOverflowException сюда НЕ попадёт — он убивает процесс,
                // поэтому completedNormally никогда не станет true
            }
            completedNormally = true;
        });

        thread.Start();
        bool joined = thread.Join(TimeSpan.FromSeconds(5));

        Assert.True(joined, "Thread did not finish — possible infinite loop");
        Assert.True(completedNormally, "Thread crashed with StackOverflowException — circular modifier dependency bug");
    }
}
