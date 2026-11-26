using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.WorldContent;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/world/{kind}")]
public sealed class WorldMaterialsController(WorldMaterialService materials) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorldMaterialDto>>> List(int campaignId, string kind, [FromQuery] string? tag, CancellationToken ct) => Ok(await materials.ListAsync(ReadSubject(), campaignId, kind, tag, ct));

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, string kind, [FromBody] WorldMaterialCreateRequest request, CancellationToken ct)
    {
        var result = await materials.CreateAsync(ReadSubject(), campaignId, kind, request, ct);
        return Created($"/api/campaigns/{campaignId}/world/{kind}/{result.Material.Id}", result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorldMaterialDto>> Get(int campaignId, string kind, Guid id, CancellationToken ct) => Ok(await materials.GetAsync(ReadSubject(), campaignId, kind, id, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WorldMaterialDto>> Update(int campaignId, string kind, Guid id, [FromBody] WorldMaterialUpdateRequest request, CancellationToken ct) => Ok(await materials.UpdateAsync(ReadSubject(), campaignId, kind, id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(int campaignId, string kind, Guid id, [FromQuery] long expectedRevision, CancellationToken ct)
    {
        await materials.DeleteAsync(ReadSubject(), campaignId, kind, id, expectedRevision, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/body")]
    public async Task<ActionResult<WorldMaterialBodyDto>> GetBody(int campaignId, string kind, Guid id, CancellationToken ct) => Ok(await materials.GetBodyAsync(ReadSubject(), campaignId, kind, id, ct));

    [HttpPut("{id:guid}/body")]
    public async Task<ActionResult<WorldMaterialBodyDto>> UpdateBody(int campaignId, string kind, Guid id, [FromBody] WorldMaterialBodyUpdateRequest request, CancellationToken ct) => Ok(await materials.UpdateBodyAsync(ReadSubject(), campaignId, kind, id, request, ct));

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
