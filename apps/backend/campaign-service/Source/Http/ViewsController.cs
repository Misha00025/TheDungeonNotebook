using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Views;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/views")]
public sealed class ViewsController(ViewService views) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ViewMetadataDto>>> List(int campaignId, CancellationToken cancellationToken) =>
        Ok(await views.ListAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, [FromBody] ViewCreateRequest request, CancellationToken cancellationToken)
    {
        var created = await views.CreateAsync(ReadSubject(), campaignId, request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { campaignId, viewId = created.Id }, created);
    }

    [HttpGet("{viewId:guid}")]
    public async Task<ActionResult<ViewMetadataDto>> Get(int campaignId, Guid viewId, CancellationToken cancellationToken) =>
        Ok(await views.GetAsync(ReadSubject(), campaignId, viewId, cancellationToken));

    [HttpPut("{viewId:guid}")]
    public async Task<ActionResult<ViewMetadataDto>> Rename(int campaignId, Guid viewId, [FromBody] ViewMetadataUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await views.RenameAsync(ReadSubject(), campaignId, viewId, request, cancellationToken));

    [HttpGet("{viewId:guid}/content")]
    public async Task<ActionResult<ViewContentEnvelope>> GetContent(int campaignId, Guid viewId, CancellationToken cancellationToken) =>
        Ok(await views.GetContentAsync(ReadSubject(), campaignId, viewId, cancellationToken));

    [HttpPut("{viewId:guid}/content")]
    public async Task<ActionResult<ViewContentEnvelope>> UpdateContent(int campaignId, Guid viewId, [FromBody] ViewContentUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await views.UpdateContentAsync(ReadSubject(), campaignId, viewId, request, cancellationToken));

    [HttpGet("{viewId:guid}/sources")]
    public async Task<ActionResult<ViewSourcesResponse>> Sources(int campaignId, Guid viewId,
        [FromQuery, Required] Guid? characterId, CancellationToken cancellationToken)
        => Ok(await views.GetSourcesAsync(ReadSubject(), campaignId, viewId, characterId!.Value, cancellationToken));

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
