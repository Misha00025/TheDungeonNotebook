using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Computation;

public sealed class ComputedSheetService(IResourceStore resources, IContentStore content, SheetService sheets)
{
    private const string FormulaCollection = "formulaContents";

    public async Task<ComputedSheetResponse> GetAsync(Subject? subject, int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        var inputs = await sheets.GetCalculationInputsAsync(subject, campaignId, characterId, cancellationToken);
        var templateFields = inputs.Template.Data.VirtualFields;
        var customFields = inputs.Sheet.Data.CustomVirtualFields;
        var formulaIds = templateFields.Concat(customFields).Select(x => x.FormulaId).Distinct().ToArray();
        var formulas = new Dictionary<Guid, FormulaInput>();
        foreach (var formulaId in formulaIds)
        {
            var metadata = await resources.GetFormulaAsync(campaignId, formulaId, cancellationToken);
            if (metadata is null) continue;
            var document = await content.GetAsync<FormulaContent>(FormulaCollection, campaignId, formulaId, cancellationToken);
            if (document is null)
                throw new DomainException(503, "content_unavailable", "The content store does not contain the published resource.", formulaId);
            formulas.Add(formulaId, new FormulaInput(formulaId, document.ContentRevision, document.Data));
        }
        var result = SheetCalculator.Calculate(inputs.BaseFields, templateFields, customFields,
            inputs.Sheet.Data.VirtualFormulaOverrides, formulas);
        return new ComputedSheetResponse(inputs.Sheet.ContentRevision, inputs.Template.ContentRevision,
            result.FormulaContentRevisions, inputs.Sheet.Data.Description, inputs.BaseFields, result.VirtualFields);
    }
}
