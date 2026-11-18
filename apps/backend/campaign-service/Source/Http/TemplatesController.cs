using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Sheets;
using Tdn.Campaigns.Computation;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/template")]
public sealed class TemplatesController(SheetService sheets, VirtualFieldService virtualFields) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TemplateMetadataDto>> Get(int campaignId, CancellationToken cancellationToken) =>
        Ok(await sheets.GetTemplateAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPut]
    public async Task<ActionResult<TemplateMetadataDto>> Rename(int campaignId, [FromBody] TemplateRenameRequest request, CancellationToken cancellationToken) =>
        Ok(await sheets.RenameTemplateAsync(ReadSubject(), campaignId, request, cancellationToken));

    [HttpGet("content")]
    public async Task<ActionResult<TemplateContentEnvelope>> Content(int campaignId, CancellationToken cancellationToken) =>
        Ok(await sheets.GetTemplateContentAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPut("content")]
    public async Task<ActionResult<TemplateContentEnvelope>> UpdateContent(int campaignId, [FromBody] TemplateContentUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await sheets.UpdateTemplateContentAsync(ReadSubject(), campaignId, request, cancellationToken));

    [HttpGet("virtual-fields")]
    public async Task<ActionResult<VirtualFieldsEnvelope>> VirtualFields(int campaignId, CancellationToken cancellationToken) =>
        Ok(await virtualFields.GetTemplateFieldsAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPut("virtual-fields")]
    public async Task<ActionResult<VirtualFieldsEnvelope>> UpdateVirtualFields(int campaignId, [FromBody] TemplateVirtualFieldsUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await virtualFields.UpdateTemplateFieldsAsync(ReadSubject(), campaignId, request, cancellationToken));

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
