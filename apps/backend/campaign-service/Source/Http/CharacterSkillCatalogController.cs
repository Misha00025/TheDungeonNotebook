using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Catalog;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/characters/{characterId:guid}/skills")]
public sealed class CharacterSkillCatalogController(CharacterCatalogService<SkillCatalog> catalog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CharacterCatalogEntryEnvelope>>> List(int campaignId, Guid characterId, CancellationToken ct) => Ok(await catalog.ListAsync(ReadSubject(), campaignId, characterId, ct));
    [HttpPost]
    public async Task<IActionResult> Add(int campaignId, Guid characterId, [FromBody] CharacterCatalogAddRequest request, CancellationToken ct)
    {
        var (result, created) = await catalog.AddAsync(ReadSubject(), campaignId, characterId, request, ct);
        return created ? Created($"/api/campaigns/{campaignId}/characters/{characterId}/skills/{result.Entry.Record.Id}", result) : Ok(result);
    }
    [HttpGet("additions/{requestId:guid}")]
    public async Task<ActionResult<CharacterCatalogAdditionDto>> Addition(int campaignId, Guid characterId, Guid requestId, CancellationToken ct) => Ok(await catalog.GetAdditionAsync(ReadSubject(), campaignId, characterId, requestId, ct));
    [HttpPost("create")]
    public async Task<IActionResult> Create(int campaignId, Guid characterId, [FromBody] CharacterCatalogCreateRequest request, CancellationToken ct)
    {
        var result = await catalog.CreateOwnAsync(ReadSubject(), campaignId, characterId, request, ct);
        return Created($"/api/campaigns/{campaignId}/characters/{characterId}/skills/{result.Entry.Record.Id}", result);
    }
    [HttpGet("{entryId:guid}")]
    public async Task<ActionResult<CharacterCatalogEntryEnvelope>> Get(int campaignId, Guid characterId, Guid entryId, CancellationToken ct) => Ok(await catalog.GetAsync(ReadSubject(), campaignId, characterId, entryId, ct));
    [HttpPut("{entryId:guid}/attributes")]
    public async Task<ActionResult<CharacterCatalogEntryEnvelope>> UpdateAttributes(int campaignId, Guid characterId, Guid entryId, [FromBody] CharacterCatalogAttributesUpdateRequest request, CancellationToken ct) => Ok(await catalog.UpdateAttributesAsync(ReadSubject(), campaignId, characterId, entryId, request, ct));
    [HttpDelete("{entryId:guid}")]
    public async Task<IActionResult> Delete(int campaignId, Guid characterId, Guid entryId, [FromQuery, System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.Range(1, long.MaxValue)] long? expectedRevision, CancellationToken ct)
    {
        await catalog.DeleteAsync(ReadSubject(), campaignId, characterId, entryId, expectedRevision!.Value, ct);
        return NoContent();
    }
    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
