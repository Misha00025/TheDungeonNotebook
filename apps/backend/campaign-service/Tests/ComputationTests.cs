using System.Text.Json;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Sheets;
using FieldValueType = Tdn.Campaigns.Sheets.ValueType;

namespace CampaignService.Tests;

public class ComputationTests
{
    [Theory]
    [InlineData("2.5", 3L)]
    [InlineData("-2.5", -3L)]
    [InlineData("2.4", 2L)]
    [InlineData("-2.4", -2L)]
    [InlineData("2.6", 3L)]
    [InlineData("-2.6", -3L)]
    public void IntegerResultsRoundAwayFromZero(string expression, long expected)
    {
        var result = Calculate([Node(1, expression, NumericResultType.Integer)]);
        Assert.Equal(expected, Assert.IsType<long>(result.VirtualFields.Single().Value));
    }

    [Fact]
    public void FractionalNumberIsKeptAndRoundedIntegerFeedsDependent()
    {
        var integer = Node(1, "2.5", NumericResultType.Integer);
        var dependent = Node(2, "x + 0.5", NumericResultType.Number, Bind("x", FieldSourceKind.Virtual, integer.Id));
        var fractional = Node(3, "2.4", NumericResultType.Number);
        var result = Calculate([integer, dependent, fractional]);
        Assert.Equal(3L, result.VirtualFields[0].Value);
        Assert.Equal(3.5d, result.VirtualFields[1].Value);
        Assert.Equal(2.4d, result.VirtualFields[2].Value);
    }

    [Fact]
    public void BooleanAndChoiceConditionalsAreLazy()
    {
        var fields = new[]
        {
            Base(10, FieldValueType.Boolean, "true"),
            Base(11, FieldValueType.SingleChoice, "\"yes\"")
        };
        var boolean = Node(1, "{b == true ? 7 : 1 / 0}", NumericResultType.Integer, Bind("b", FieldSourceKind.Base, fields[0].Id));
        var choice = Node(2, "{c == \"yes\" ? 4 : 1 / 0}", NumericResultType.Integer, Bind("c", FieldSourceKind.Base, fields[1].Id));
        var result = Calculate([boolean, choice], fields);
        Assert.Equal(7L, result.VirtualFields[0].Value);
        Assert.Equal(4L, result.VirtualFields[1].Value);
    }

    [Fact]
    public void RejectsNonNumericResultsAndForbiddenCoercion()
    {
        var fields = new[] { Base(10, FieldValueType.Boolean, "true"), Base(11, FieldValueType.String, "\"4\"") };
        var boolean = Node(1, "b", NumericResultType.Number, Bind("b", FieldSourceKind.Base, fields[0].Id));
        var text = Node(2, "\"text\"", NumericResultType.Number);
        var boolMath = Node(3, "b + 1", NumericResultType.Number, Bind("b", FieldSourceKind.Base, fields[0].Id));
        var stringMath = Node(4, "s + 1", NumericResultType.Number, Bind("s", FieldSourceKind.Base, fields[1].Id));
        var result = Calculate([boolean, text, boolMath, stringMath], fields);
        Assert.Equal("type_error", result.VirtualFields[0].Diagnostic?.Code);
        Assert.Equal("type_error", result.VirtualFields[1].Diagnostic?.Code);
        Assert.NotNull(result.VirtualFields[2].Diagnostic);
        Assert.NotNull(result.VirtualFields[3].Diagnostic);
    }

    [Fact]
    public void ResolvesBaseAndVirtualBindingsAndMultipleInputs()
    {
        var bases = new[] { Base(10, FieldValueType.Integer, "2"), Base(11, FieldValueType.Integer, "3") };
        var parent = Node(1, "parent + y", NumericResultType.Integer,
            new() { ["parent"] = new(FieldSourceKind.Base, bases[0].Id), ["y"] = new(FieldSourceKind.Base, bases[1].Id) });
        var child = Node(2, "parent * 2", NumericResultType.Integer, Bind("parent", FieldSourceKind.Virtual, parent.Id));
        var result = Calculate([parent, child], bases);
        Assert.Equal(5L, result.VirtualFields[0].Value);
        Assert.Equal(10L, result.VirtualFields[1].Value);
    }

    [Theory]
    [InlineData("parent", "parent", "missing_input")]
    [InlineData("parent", "Parent", "missing_input")]
    public void ParameterBindingsAreRequiredAndCaseSensitive(string expressionParameter, string bindingName, string diagnostic)
    {
        var node = Node(1, expressionParameter, NumericResultType.Integer,
            bindingName == expressionParameter ? new() : Bind(bindingName, FieldSourceKind.Base, Id(10)),
            formulaParameters: [expressionParameter]);
        var result = Calculate([node], [Base(10, FieldValueType.Integer, "2")]);
        Assert.Equal(diagnostic, result.VirtualFields.Single().Diagnostic?.Code);
    }

    [Fact]
    public void ParentNamedVirtualBindingCanCreateCycle()
    {
        var node = Node(1, "parent", NumericResultType.Integer, Bind("parent", FieldSourceKind.Virtual, Id(1)));
        var result = Calculate([node]);
        Assert.Equal("cycle", result.VirtualFields.Single().Diagnostic?.Code);
    }

    [Fact]
    public void CyclesAreIsolatedAndIndependentNodesCalculate()
    {
        var a = Node(1, "b + 1", NumericResultType.Integer, Bind("b", FieldSourceKind.Virtual, Id(2)));
        var b = Node(2, "a + 1", NumericResultType.Integer, Bind("a", FieldSourceKind.Virtual, a.Id));
        var self = Node(3, "self + 1", NumericResultType.Integer, Bind("self", FieldSourceKind.Virtual, Id(3)));
        var good = Node(4, "42", NumericResultType.Integer);
        var result = Calculate([a, b, self, good]);
        Assert.Equal("cycle", result.VirtualFields[0].Diagnostic?.Code);
        Assert.Equal("cycle", result.VirtualFields[1].Diagnostic?.Code);
        Assert.Equal("cycle", result.VirtualFields[2].Diagnostic?.Code);
        Assert.Equal(42L, result.VirtualFields[3].Value);
    }

    [Fact]
    public void ReportsMissingReferencesFormulaAndUndeclaredParameters()
    {
        var missingInput = Node(1, "x + 1", NumericResultType.Number, formulaParameters: ["x"]);
        var unknown = Node(2, "x + 1", NumericResultType.Number, Bind("x", FieldSourceKind.Base, Id(99)));
        var undeclared = Node(3, "x + 1", NumericResultType.Number, Bind("x", FieldSourceKind.Base, Id(20)), formulaParameters: []);
        var missingFormula = Node(4, "1", NumericResultType.Number, formulaId: Id(404));
        var result = Calculate([missingInput, unknown, undeclared, missingFormula], [Base(20, FieldValueType.Integer, "2")]);
        Assert.Equal("missing_input", result.VirtualFields[0].Diagnostic?.Code);
        Assert.Equal("unknown_reference", result.VirtualFields[1].Diagnostic?.Code);
        Assert.Equal("unknown_parameter", result.VirtualFields[2].Diagnostic?.Code);
        Assert.Equal("missing_formula", result.VirtualFields[3].Diagnostic?.Code);
    }

    [Fact]
    public void TemplateOverridesAndCustomFieldsUseTheirSelectedFormula()
    {
        var template = Node(1, "x + 1", NumericResultType.Integer, Bind("x", FieldSourceKind.Base, Id(10)));
        var custom = Node(2, "x + 2", NumericResultType.Integer, Bind("x", FieldSourceKind.Base, Id(10)));
        var result = Calculate([template], [Base(10, FieldValueType.Integer, "3")], [custom], [new(template.Id, "x + 5")]);
        Assert.Equal(8L, result.VirtualFields[0].Value);
        Assert.Equal(5L, result.VirtualFields[1].Value);
        Assert.Equal(2, result.FormulaContentRevisions.Count);
    }

    [Fact]
    public void ResultsAreTransientAndFailuresContainNoInputValues()
    {
        var node = Node(1, "1 / 0", NumericResultType.Number);
        var result = Calculate([node]);
        Assert.Null(result.VirtualFields.Single().Value);
        Assert.Equal("arithmetic_error", result.VirtualFields.Single().Diagnostic?.Code);
        Assert.DoesNotContain("1 / 0", result.VirtualFields.Single().Diagnostic?.Message);
    }

    [Fact]
    public void IntegralJsonNumberAboveDoublePrecisionRemainsExact()
    {
        var input = Base(10, FieldValueType.Integer, "9007199254740993.0");
        var node = Node(1, "x", NumericResultType.Integer, Bind("x", FieldSourceKind.Base, input.Id));
        var result = Calculate([node], [input]);
        Assert.Equal(9007199254740993L, result.VirtualFields.Single().Value);
    }

    [Fact]
    public void OverrideCannotReplaceMissingFormulaDefinition()
    {
        var node = Node(1, "1", NumericResultType.Integer, formulaId: Id(404));
        var result = SheetCalculator.Calculate([], [node], [], [new(node.Id, "12")], new Dictionary<Guid, FormulaInput>());
        Assert.Equal("missing_formula", result.VirtualFields.Single().Diagnostic?.Code);
    }

    [Fact]
    public void UnselectedCyclicDependencyDoesNotBreakConditionalValue()
    {
        var cyclic = Node(1, "self + 1", NumericResultType.Integer, Bind("self", FieldSourceKind.Virtual, Id(1)));
        var conditional = Node(2, "true ? 8 : other", NumericResultType.Integer, Bind("other", FieldSourceKind.Virtual, cyclic.Id));
        var result = Calculate([cyclic, conditional]);
        Assert.Equal("cycle", result.VirtualFields[0].Diagnostic?.Code);
        Assert.Equal(8L, result.VirtualFields[1].Value);
    }

    [Fact]
    public void FormulaValidationRejectsInvalidExpressionsWithoutEchoingThem()
    {
        var invalid = Assert.Throws<DomainException>(() => FormulaService.Validate("this is not valid !!!", []));
        Assert.Equal(400, invalid.StatusCode);
        Assert.Equal("invalid_formula", invalid.Code);
        Assert.DoesNotContain("this is not valid", invalid.Message);
        var undeclared = Assert.Throws<DomainException>(() => FormulaService.Validate("x + 1", []));
        Assert.Equal("invalid_formula", undeclared.Code);
    }

    [Fact]
    public void PreparedPublicExpressionCanBeEvaluatedRepeatedlyWithFreshResolvers()
    {
        var prepared = ExpressionAdapter.Prepare("x + 1");
        Assert.Equal(2d, Convert.ToDouble(prepared.Evaluate(_ => 1)));
        Assert.Equal(3d, Convert.ToDouble(prepared.Evaluate(_ => 2)));
    }

    private static ComputationResult Calculate(IReadOnlyList<VirtualField> nodes, IReadOnlyList<EffectiveBaseField>? bases = null,
        IReadOnlyList<VirtualField>? customs = null, IReadOnlyList<VirtualFormulaOverride>? overrides = null) =>
        SheetCalculator.Calculate(bases ?? [], nodes, customs ?? [], overrides ?? [],
            nodes.Concat(customs ?? []).Where(x => x.FormulaId != Id(404)).Select(x => x.FormulaId).Distinct().ToDictionary(x => x, x =>
            {
                var node = nodes.Concat(customs ?? []).Single(n => n.FormulaId == x);
                return new FormulaInput(x, 1, new FormulaContent(FormulaFor(node), node.Description.Split(',', StringSplitOptions.RemoveEmptyEntries)));
            }));

    private static string FormulaFor(VirtualField node) => node.Key.StartsWith("expr:", StringComparison.Ordinal) ? node.Key[5..] : "";
    private static Dictionary<string, FieldReference> Bind(string name, FieldSourceKind kind, Guid id) => new(StringComparer.Ordinal) { [name] = new(kind, id) };
    private static VirtualField Node(int id, string expression, NumericResultType resultType, Dictionary<string, FieldReference>? bindings = null,
        Guid? formulaId = null, string[]? formulaParameters = null) =>
        new(Id(id), "expr:" + expression, "field", string.Join(",", formulaParameters ?? (bindings ?? new()).Keys.ToArray()),
            resultType, formulaId ?? Id(id + 1000), bindings ?? new());
    private static EffectiveBaseField Base(int id, FieldValueType type, string json) =>
        new(Id(id), "base" + id, "base", "", type, 1, [], JsonDocument.Parse(json).RootElement.Clone(), false);
    private static Guid Id(int value) => Guid.Parse($"00000000-0000-0000-0000-{value:D12}");
}
