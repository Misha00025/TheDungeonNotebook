using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Sheets;
using Tdn.Campaigns.Computation;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/templates")]
public sealed class TemplatesController(SheetService sheets, VirtualFieldService virtualFields) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TemplateMetadataDto>>> List(int campaignId, CancellationToken cancellationToken) =>
        Ok(await sheets.ListTemplatesAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, [FromBody] TemplateCreateRequest request, CancellationToken cancellationToken)
    {
        var result = await sheets.CreateTemplateAsync(ReadSubject(), campaignId, request, cancellationToken);
        return Created($"/api/campaigns/{campaignId}/templates/{result.Id}", result);
    }

    [HttpGet("{templateId:guid}")]
    public async Task<ActionResult<TemplateMetadataDto>> Get(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        Ok(await sheets.GetTemplateAsync(ReadSubject(), campaignId, templateId, cancellationToken));

    [HttpPut("{templateId:guid}")]
    public async Task<ActionResult<TemplateMetadataDto>> Rename(int campaignId, Guid templateId, [FromBody] TemplateRenameRequest request, CancellationToken cancellationToken) =>
        Ok(await sheets.RenameTemplateAsync(ReadSubject(), campaignId, templateId, request, cancellationToken));

    [HttpGet("{templateId:guid}/content")]
    public async Task<ActionResult<TemplateContentEnvelope>> Content(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        Ok(await sheets.GetTemplateContentAsync(ReadSubject(), campaignId, templateId, cancellationToken));

    [HttpPut("{templateId:guid}/content")]
    public async Task<ActionResult<TemplateContentEnvelope>> UpdateContent(int campaignId, Guid templateId, [FromBody] TemplateContentUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await sheets.UpdateTemplateContentAsync(ReadSubject(), campaignId, templateId, request, cancellationToken));

    [HttpGet("{templateId:guid}/virtual-fields")]
    public async Task<ActionResult<VirtualFieldsEnvelope>> VirtualFields(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        Ok(await virtualFields.GetTemplateFieldsAsync(ReadSubject(), campaignId, templateId, cancellationToken));

    [HttpPut("{templateId:guid}/virtual-fields")]
    public async Task<ActionResult<VirtualFieldsEnvelope>> UpdateVirtualFields(int campaignId, Guid templateId, [FromBody] VirtualFieldsUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await virtualFields.UpdateTemplateFieldsAsync(ReadSubject(), campaignId, templateId, request, cancellationToken));

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
