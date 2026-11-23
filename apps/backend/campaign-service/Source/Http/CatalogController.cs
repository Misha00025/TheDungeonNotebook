using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Catalog;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/items")]
public sealed class CatalogController(CatalogService<ItemCatalog> catalog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CatalogEntryDto>>> List(int campaignId, CancellationToken ct) => Ok(await catalog.ListAsync(ReadSubject(), campaignId, ct));

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, [FromBody] CatalogCreateRequest request, CancellationToken ct)
    {
        var result = await catalog.CreateAsync(ReadSubject(), campaignId, request, ct);
        return Created($"/api/campaigns/{campaignId}/items/{result.Entry.Id}", result);
    }

    [HttpGet("{entryId:guid}")]
    public async Task<ActionResult<CatalogEntryDto>> Get(int campaignId, Guid entryId, CancellationToken ct) => Ok(await catalog.GetAsync(ReadSubject(), campaignId, entryId, ct));

    [HttpPut("{entryId:guid}")]
    public async Task<ActionResult<CatalogEntryDto>> Update(int campaignId, Guid entryId, [FromBody] CatalogMetadataUpdateRequest request, CancellationToken ct) => Ok(await catalog.UpdateMetadataAsync(ReadSubject(), campaignId, entryId, request, ct));

    [HttpGet("{entryId:guid}/content")]
    public async Task<ActionResult<CatalogContentEnvelope>> GetContent(int campaignId, Guid entryId, CancellationToken ct) => Ok(await catalog.GetContentAsync(ReadSubject(), campaignId, entryId, ct));

    [HttpPut("{entryId:guid}/content")]
    public async Task<ActionResult<CatalogContentEnvelope>> UpdateContent(int campaignId, Guid entryId, [FromBody] CatalogContentUpdateRequest request, CancellationToken ct) => Ok(await catalog.UpdateContentAsync(ReadSubject(), campaignId, entryId, request, ct));

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
