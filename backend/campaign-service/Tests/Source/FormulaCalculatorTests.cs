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
    public void CalculateFields_CircularReference_DoesNotStackOverflow()
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
}
