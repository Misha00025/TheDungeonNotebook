using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Views;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/presentation")]
public sealed class PresentationController(PresentationService presentation) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PresentationEnvelope>> Get(int campaignId, CancellationToken cancellationToken) =>
        Ok(await presentation.GetAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPut]
    public async Task<ActionResult<PresentationEnvelope>> Update(int campaignId, [FromBody] PresentationUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await presentation.UpdateAsync(ReadSubject(), campaignId, request, cancellationToken));

    [HttpGet("resolve")]
    public async Task<ActionResult<ResolvedPresentationDto>> Resolve(int campaignId,
        [FromQuery, Required] string? contextKey, CancellationToken cancellationToken) =>
        Ok(await presentation.ResolveAsync(ReadSubject(), campaignId, contextKey!, cancellationToken));

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
