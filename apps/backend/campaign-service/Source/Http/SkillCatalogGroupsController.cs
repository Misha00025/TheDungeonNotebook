using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Catalog;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/catalog/skills/groups")]
public sealed class SkillCatalogGroupsController(CatalogGroupService<SkillCatalog> groups) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CatalogGroupsEnvelope>> List(int campaignId, CancellationToken ct) => Ok(await groups.ListAsync(ReadSubject(), campaignId, ct));
    [HttpGet("configuration")]
    public async Task<ActionResult<CatalogGroupConfigurationEnvelope>> Configuration(int campaignId, CancellationToken ct) => Ok(await groups.GetConfigurationAsync(ReadSubject(), campaignId, ct));
    [HttpPut]
    public async Task<ActionResult<CatalogGroupConfigurationEnvelope>> Update(int campaignId, [FromBody] CatalogGroupsUpdateRequest request, CancellationToken ct) => Ok(await groups.UpdateConfigurationAsync(ReadSubject(), campaignId, request, ct));
    [HttpGet("{groupId:guid}/entries")]
    public async Task<ActionResult<CatalogGroupEntriesEnvelope>> Entries(int campaignId, Guid groupId, CancellationToken ct) => Ok(await groups.GetEntriesAsync(ReadSubject(), campaignId, groupId, ct));
    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
