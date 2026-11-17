using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Computation;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/formulas")]
public sealed class FormulasController(FormulaService formulas) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FormulaMetadataDto>>> List(int campaignId, CancellationToken cancellationToken) =>
        Ok(await formulas.ListAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, [FromBody] FormulaCreateRequest request, CancellationToken cancellationToken)
    {
        var result = await formulas.CreateAsync(ReadSubject(), campaignId, request, cancellationToken);
        return Created($"/api/campaigns/{campaignId}/formulas/{result.Id}", result);
    }

    [HttpGet("{formulaId:guid}")]
    public async Task<ActionResult<FormulaMetadataDto>> Get(int campaignId, Guid formulaId, CancellationToken cancellationToken) =>
        Ok(await formulas.GetAsync(ReadSubject(), campaignId, formulaId, cancellationToken));

    [HttpPut("{formulaId:guid}")]
    public async Task<ActionResult<FormulaMetadataDto>> Rename(int campaignId, Guid formulaId, [FromBody] FormulaMetadataUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await formulas.RenameAsync(ReadSubject(), campaignId, formulaId, request, cancellationToken));

    [HttpGet("{formulaId:guid}/content")]
    public async Task<ActionResult<FormulaContentEnvelope>> Content(int campaignId, Guid formulaId, CancellationToken cancellationToken) =>
        Ok(await formulas.GetContentAsync(ReadSubject(), campaignId, formulaId, cancellationToken));

    [HttpPut("{formulaId:guid}/content")]
    public async Task<ActionResult<FormulaContentEnvelope>> UpdateContent(int campaignId, Guid formulaId, [FromBody] FormulaContentUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await formulas.UpdateContentAsync(ReadSubject(), campaignId, formulaId, request, cancellationToken));

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
