using System.Globalization;
using System.Text.Json;
using Tdn.Campaigns.Sheets;
using SheetValueType = Tdn.Campaigns.Sheets.ValueType;

namespace Tdn.Campaigns.Computation;

public static class SheetCalculator
{
    public static ComputationResult Calculate(
        IReadOnlyList<EffectiveBaseField> baseFields,
        IReadOnlyList<VirtualField> templateVirtualFields,
        IReadOnlyList<VirtualField> customVirtualFields,
        IReadOnlyList<VirtualFormulaOverride> overrides,
        IReadOnlyDictionary<Guid, FormulaInput> formulas)
    {
        var bases = baseFields.ToDictionary(x => x.Id, ConvertBaseValue);
        var nodes = templateVirtualFields.Concat(customVirtualFields).ToArray();
        var byId = nodes.ToDictionary(x => x.Id);
        var templateIds = templateVirtualFields.Select(x => x.Id).ToHashSet();
        var overrideMap = overrides.Where(x => templateIds.Contains(x.VirtualFieldId)).GroupBy(x => x.VirtualFieldId).ToDictionary(x => x.Key, x => x.Last().Expression);
        var states = new Dictionary<Guid, NodeState>();

        foreach (var node in nodes)
        {
            if (!formulas.TryGetValue(node.FormulaId, out var formulaInput))
            {
                states[node.Id] = NodeState.Failed("missing_formula");
                continue;
            }
            var expressionText = overrideMap.TryGetValue(node.Id, out var replacement)
                ? replacement
                : formulaInput.Data.Expression;
            try
            {
                var prepared = ExpressionAdapter.Prepare(expressionText);
                states[node.Id] = NodeState.Ready(prepared, formulaInput.Data.Parameters.ToHashSet(StringComparer.Ordinal));
            }
            catch (OperationCanceledException) { throw; }
            catch
            {
                states[node.Id] = NodeState.Failed("syntax_error");
            }
        }

        foreach (var node in nodes)
        {
            if (!states.TryGetValue(node.Id, out var state) || state.Diagnostic is not null)
                continue;
            if (node.ParentBaseFieldId is not null && node.ParentVirtualFieldId is not null ||
                node.ParentBaseFieldId is not null && node.Bindings.ContainsKey("parent") ||
                node.ParentVirtualFieldId is not null && node.Bindings.ContainsKey("parent"))
            {
                states[node.Id] = NodeState.Failed("invalid_reference");
                continue;
            }
            var deps = new HashSet<Guid>();
            string? diagnostic = null;
            foreach (var parameter in state.Prepared!.ParameterNames)
            {
                if (!state.Declared!.Contains(parameter))
                {
                    diagnostic = "unknown_parameter";
                    break;
                }
                FieldReference? reference = null;
                if (node.Bindings.TryGetValue(parameter, out var binding))
                    reference = binding;
                else if (parameter == "parent" && node.ParentBaseFieldId is not null)
                    reference = new FieldReference(FieldSourceKind.Base, node.ParentBaseFieldId.Value);
                else if (parameter == "parent" && node.ParentVirtualFieldId is not null)
                    reference = new FieldReference(FieldSourceKind.Virtual, node.ParentVirtualFieldId.Value);
                if (reference is null)
                {
                    diagnostic = "missing_input";
                    break;
                }
                if (reference.Kind == FieldSourceKind.Base)
                {
                    if (!bases.ContainsKey(reference.FieldId))
                    {
                        diagnostic = "unknown_reference";
                        break;
                    }
                }
                else
                {
                    if (!byId.ContainsKey(reference.FieldId) || templateIds.Contains(node.Id) && !templateIds.Contains(reference.FieldId))
                    {
                        diagnostic = "unknown_reference";
                        break;
                    }
                    deps.Add(reference.FieldId);
                }
            }
            states[node.Id] = state with { Dependencies = deps, Diagnostic = diagnostic is null ? null : Diagnostic(diagnostic) };
        }

        MarkCycles(nodes, states);
        var values = new Dictionary<Guid, object?>();
        var evaluating = new HashSet<Guid>();
        object? Resolve(Guid id)
        {
            if (values.TryGetValue(id, out var cached)) return cached;
            if (!states.TryGetValue(id, out var state) || state.Diagnostic is not null)
                throw new CalculationFailure("dependency_error");
            if (!evaluating.Add(id)) throw new CalculationFailure("dependency_error");
            var node = byId[id];
            CalculationFailure? resolverFailure = null;
            try
            {
                var result = state.Prepared!.Evaluate(parameter =>
                {
                    FieldReference? reference = null;
                    if (node.Bindings.TryGetValue(parameter, out var binding)) reference = binding;
                    else if (parameter == "parent" && node.ParentBaseFieldId is not null) reference = new FieldReference(FieldSourceKind.Base, node.ParentBaseFieldId.Value);
                    else if (parameter == "parent" && node.ParentVirtualFieldId is not null) reference = new FieldReference(FieldSourceKind.Virtual, node.ParentVirtualFieldId.Value);
                    if (reference is null) throw new CalculationFailure("missing_input");
                    if (reference.Kind == FieldSourceKind.Base) return bases.TryGetValue(reference.FieldId, out var value) ? value : throw new CalculationFailure("unknown_reference");
                    if (!byId.ContainsKey(reference.FieldId)) throw new CalculationFailure("unknown_reference");
                    try { return Resolve(reference.FieldId); }
                    catch (CalculationFailure)
                    {
                        resolverFailure = new CalculationFailure("dependency_error");
                        throw resolverFailure;
                    }
                });
                var normalized = NormalizeResult(result, node.ResultType);
                values[id] = normalized;
                return normalized;
            }
            catch (CalculationFailure) { throw; }
            catch (Exception) when (resolverFailure is not null) { throw resolverFailure!; }
            catch (Exception) { throw new CalculationFailure("arithmetic_error"); }
            finally { evaluating.Remove(id); }
        }

        var results = new List<VirtualResult>(nodes.Length);
        foreach (var node in nodes)
        {
            var state = states[node.Id];
            if (state.Diagnostic is not null)
            {
                results.Add(ToResult(node, null, state.Diagnostic));
                continue;
            }
            try { results.Add(ToResult(node, Resolve(node.Id), null)); }
            catch (CalculationFailure failure) { results.Add(ToResult(node, null, Diagnostic(failure.Code))); }
        }
        return new ComputationResult(results, formulas.Values.Select(x => new FormulaRevision(x.Id, x.ContentRevision)).ToArray());
    }

    private static void MarkCycles(VirtualField[] nodes, Dictionary<Guid, NodeState> states)
    {
        var index = 0;
        var stack = new Stack<Guid>();
        var indices = new Dictionary<Guid, int>();
        var low = new Dictionary<Guid, int>();
        var onStack = new HashSet<Guid>();
        void Visit(Guid id)
        {
            indices[id] = low[id] = index++;
            stack.Push(id); onStack.Add(id);
            foreach (var next in states[id].Dependencies ?? [])
            {
                if (!indices.ContainsKey(next)) { Visit(next); low[id] = Math.Min(low[id], low[next]); }
                else if (onStack.Contains(next)) low[id] = Math.Min(low[id], indices[next]);
            }
            if (low[id] != indices[id]) return;
            var component = new List<Guid>();
            Guid current;
            do { current = stack.Pop(); onStack.Remove(current); component.Add(current); } while (current != id);
            if (component.Count > 1 || states[id].Dependencies?.Contains(id) == true)
                foreach (var member in component) states[member] = states[member] with { Diagnostic = Diagnostic("cycle") };
        }
        foreach (var node in nodes)
            if (!indices.ContainsKey(node.Id) && states[node.Id].Diagnostic is null) Visit(node.Id);
    }

    private static object? ConvertBaseValue(EffectiveBaseField field)
    {
        var value = field.EffectiveValue;
        return field.ValueType switch
        {
            SheetValueType.Integer when value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var integer) => integer,
            SheetValueType.Integer when value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var decimalInteger) && decimal.Truncate(decimalInteger) == decimalInteger && decimalInteger >= long.MinValue && decimalInteger <= long.MaxValue => decimal.ToInt64(decimalInteger),
            SheetValueType.Number when value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number) => number,
            SheetValueType.String or SheetValueType.SingleChoice when value.ValueKind == JsonValueKind.String => value.GetString(),
            SheetValueType.Boolean when value.ValueKind is JsonValueKind.True or JsonValueKind.False => value.GetBoolean(),
            SheetValueType.MultiChoice when value.ValueKind == JsonValueKind.Array => value.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToArray(),
            _ => null
        };
    }

    private static object NormalizeResult(object? value, NumericResultType type)
    {
        if (value is long integer)
        {
            if (type == NumericResultType.Integer) return integer;
            return (double)integer;
        }
        if (value is not (double or float or decimal or int or short or byte or uint or ulong))
            throw new CalculationFailure("type_error");
        var number = Convert.ToDouble(value, CultureInfo.InvariantCulture);
        if (!double.IsFinite(number)) throw new CalculationFailure("arithmetic_error");
        if (type == NumericResultType.Number) return number;
        var rounded = Math.Round(number, MidpointRounding.AwayFromZero);
        if (rounded < -9223372036854775808d || rounded >= 9223372036854775808d)
            throw new CalculationFailure("arithmetic_error");
        return checked((long)rounded);
    }

    private static VirtualResult ToResult(VirtualField node, object? value, CalculationDiagnostic? diagnostic) =>
        new(node.Id, node.Key, node.Title, node.Description, node.ResultType, value, diagnostic);
    private static CalculationDiagnostic Diagnostic(string code) => new(code, Messages.GetValueOrDefault(code, "Calculation failed."));
    private static readonly Dictionary<string, string> Messages = new()
    {
        ["missing_formula"] = "Formula is unavailable.", ["syntax_error"] = "Formula syntax is invalid.",
        ["type_error"] = "Formula result has an incompatible type.", ["arithmetic_error"] = "Formula arithmetic failed.",
        ["dependency_error"] = "A required calculation failed.", ["unknown_reference"] = "A referenced field is unavailable.",
        ["missing_input"] = "A required input is not bound.", ["unknown_parameter"] = "Formula uses an undeclared parameter.",
        ["cycle"] = "Formula dependencies contain a cycle.", ["invalid_reference"] = "Field references are invalid."
    };

    private sealed record NodeState(PreparedExpression? Prepared, HashSet<string>? Declared, HashSet<Guid>? Dependencies, CalculationDiagnostic? Diagnostic)
    {
        public static NodeState Ready(PreparedExpression expression, HashSet<string> declared) => new(expression, declared, [], null);
        public static NodeState Failed(string code) => new(null, null, null, SheetCalculator.Diagnostic(code));
    }

    private sealed class CalculationFailure(string code) : Exception
    {
        public string Code { get; } = code;
    }
}
