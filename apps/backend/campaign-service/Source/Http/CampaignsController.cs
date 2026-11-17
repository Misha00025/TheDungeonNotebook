using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns")]
public sealed class CampaignsController(CampaignService campaigns) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCampaignRequest request, CancellationToken cancellationToken)
    {
        var result = await campaigns.CreateAsync(ReadSubject(), request, cancellationToken);
        return Created($"/api/campaigns/{result.Id}", result);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CampaignDto>>> List(CancellationToken cancellationToken) =>
        Ok(await campaigns.ListAsync(ReadSubject(), cancellationToken));

    [HttpGet("creation/{requestId:guid}")]
    public async Task<ActionResult<CreationStatusDto>> CreationStatus(Guid requestId, CancellationToken cancellationToken) =>
        Ok(await campaigns.GetCreationStatusAsync(ReadSubject(), requestId, cancellationToken));

    [HttpGet("{campaignId:int}", Name = "GetCampaign")]
    public async Task<ActionResult<CampaignDto>> Get(int campaignId, CancellationToken cancellationToken) =>
        Ok(await campaigns.GetAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpGet("{campaignId:int}/permissions")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<ResourcePermissionsDto>> Permissions(int campaignId, CancellationToken cancellationToken) =>
        Ok(await campaigns.GetPermissionsAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPut("{campaignId:int}")]
    public async Task<ActionResult<CampaignDto>> Rename(int campaignId, [FromBody] RenameCampaignRequest request, CancellationToken cancellationToken) =>
        Ok(await campaigns.RenameAsync(ReadSubject(), campaignId, request, cancellationToken));

    [HttpGet("{campaignId:int}/members")]
    public async Task<ActionResult<IReadOnlyList<CampaignMemberDto>>> Members(int campaignId, CancellationToken cancellationToken) =>
        Ok(await campaigns.ListMembersAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPut("{campaignId:int}/members/{userId:int}")]
    public async Task<IActionResult> UpsertMember(int campaignId, int userId, [FromBody] UpsertCampaignMemberRequest request, CancellationToken cancellationToken)
    {
        var (member, created) = await campaigns.UpsertMemberAsync(ReadSubject(), campaignId, userId, request, cancellationToken);
        if (!created)
            return Ok(member);
        return Created($"/api/campaigns/{campaignId}/members/{userId}", member);
    }

    [HttpDelete("{campaignId:int}/members/{userId:int}")]
    public async Task<IActionResult> DeleteMember(
        int campaignId,
        int userId,
        [FromQuery, System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.Range(1, long.MaxValue)] long? expectedRevision,
        CancellationToken cancellationToken)
    {
        await campaigns.DeleteMemberAsync(ReadSubject(), campaignId, userId, expectedRevision!.Value, cancellationToken);
        return NoContent();
    }

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
