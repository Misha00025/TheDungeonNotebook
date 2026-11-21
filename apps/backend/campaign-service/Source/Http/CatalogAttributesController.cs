using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Catalog;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/catalog/attributes")]
public sealed class CatalogAttributesController(CatalogService catalog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CatalogAttributeSchemaEnvelope>> Get(int campaignId, CancellationToken ct) => Ok(await catalog.GetAttributesAsync(SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault()), campaignId, ct));

    [HttpPut]
    public async Task<ActionResult<CatalogAttributeSchemaEnvelope>> Put(int campaignId, [FromBody] CatalogAttributesUpdateRequest request, CancellationToken ct) => Ok(await catalog.UpdateAttributesAsync(SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault()), campaignId, request, ct));
}
