using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Catalog;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/catalog/skills/attributes")]
public sealed class SkillCatalogAttributesController(CatalogService<SkillCatalog> catalog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CatalogAttributeSchemaEnvelope>> Get(int campaignId, CancellationToken ct) => Ok(await catalog.GetAttributesAsync(SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault()), campaignId, ct));
    [HttpPut]
    public async Task<ActionResult<CatalogAttributeSchemaEnvelope>> Put(int campaignId, [FromBody] CatalogAttributesUpdateRequest request, CancellationToken ct) => Ok(await catalog.UpdateAttributesAsync(SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault()), campaignId, request, ct));
    [HttpDelete("{attributeId:guid}")]
    public async Task<ActionResult<CatalogAttributeSchemaEnvelope>> Delete(int campaignId, Guid attributeId, [FromQuery, System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.Range(1, long.MaxValue)] long? expectedRevision, CancellationToken ct) => Ok(await catalog.DeleteAttributeAsync(SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault()), campaignId, attributeId, expectedRevision!.Value, ct));
}
