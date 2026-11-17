using Microsoft.AspNetCore.Mvc;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Sheets;
using Tdn.Campaigns.Computation;

namespace Tdn.Campaigns.Http;

[ApiController]
[Route("api/campaigns/{campaignId:int}/characters")]
public sealed class CharactersController(SheetService sheets, VirtualFieldService virtualFields, ComputedSheetService computedSheets) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CharacterMetadataDto>>> List(int campaignId, CancellationToken cancellationToken) =>
        Ok(await sheets.ListCharactersAsync(ReadSubject(), campaignId, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, [FromBody] CharacterCreateRequest request, CancellationToken cancellationToken)
    {
        var result = await sheets.CreateCharacterAsync(ReadSubject(), campaignId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("{characterId:guid}")]
    public async Task<ActionResult<CharacterMetadataDto>> Get(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Ok(await sheets.GetCharacterAsync(ReadSubject(), campaignId, characterId, cancellationToken));

    [HttpGet("{characterId:guid}/permissions")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<ResourcePermissionsDto>> Permissions(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Ok(await sheets.GetCharacterPermissionsAsync(ReadSubject(), campaignId, characterId, cancellationToken));

    [HttpPut("{characterId:guid}")]
    public async Task<ActionResult<CharacterMetadataDto>> Update(int campaignId, Guid characterId, [FromBody] CharacterUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await sheets.UpdateCharacterAsync(ReadSubject(), campaignId, characterId, request, cancellationToken));

    [HttpGet("{characterId:guid}/sheet")]
    public async Task<ActionResult<CharacterSheetEnvelope>> Sheet(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Ok(await sheets.GetCharacterSheetAsync(ReadSubject(), campaignId, characterId, cancellationToken));

    [HttpGet("{characterId:guid}/computed-sheet")]
    public async Task<ActionResult<ComputedSheetResponse>> ComputedSheet(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Ok(await computedSheets.GetAsync(ReadSubject(), campaignId, characterId, cancellationToken));

    [HttpGet("{characterId:guid}/custom-virtual-fields")]
    public async Task<ActionResult<VirtualFieldsEnvelope>> CustomVirtualFields(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Ok(await virtualFields.GetCustomFieldsAsync(ReadSubject(), campaignId, characterId, cancellationToken));

    [HttpPut("{characterId:guid}/custom-virtual-fields")]
    public async Task<ActionResult<VirtualFieldsEnvelope>> UpdateCustomVirtualFields(int campaignId, Guid characterId, [FromBody] VirtualFieldsUpdateRequest request, CancellationToken cancellationToken) =>
        Ok(await virtualFields.UpdateCustomFieldsAsync(ReadSubject(), campaignId, characterId, request, cancellationToken));

    [HttpGet("{characterId:guid}/virtual-overrides")]
    public async Task<ActionResult<OverridesEnvelope>> VirtualOverrides(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Ok(await virtualFields.GetOverridesAsync(ReadSubject(), campaignId, characterId, cancellationToken));

    [HttpPut("{characterId:guid}/virtual-overrides/{virtualFieldId:guid}")]
    public async Task<ActionResult<ContentRevisionDto>> SetVirtualOverride(int campaignId, Guid characterId, Guid virtualFieldId, [FromBody] OverrideInput request, CancellationToken cancellationToken) =>
        Ok(await virtualFields.SetOverrideAsync(ReadSubject(), campaignId, characterId, virtualFieldId, request, cancellationToken));

    [HttpDelete("{characterId:guid}/virtual-overrides/{virtualFieldId:guid}")]
    public async Task<ActionResult<ContentRevisionDto>> DeleteVirtualOverride(int campaignId, Guid characterId, Guid virtualFieldId,
        [FromQuery, System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.Range(1, long.MaxValue)] long? expectedRevision,
        CancellationToken cancellationToken) =>
        Ok(await virtualFields.DeleteOverrideAsync(ReadSubject(), campaignId, characterId, virtualFieldId, expectedRevision!.Value, cancellationToken));

    [HttpPut("{characterId:guid}/description")]
    public async Task<ActionResult<ContentRevisionDto>> UpdateDescription(int campaignId, Guid characterId, [FromBody] CharacterDescriptionRequest request, CancellationToken cancellationToken) =>
        Ok(await sheets.UpdateCharacterDescriptionAsync(ReadSubject(), campaignId, characterId, request, cancellationToken));

    [HttpPut("{characterId:guid}/base-values/{fieldId:guid}")]
    public async Task<ActionResult<CharacterSheetEnvelope>> SetBaseValue(int campaignId, Guid characterId, Guid fieldId, [FromBody] BaseValueRequest request, CancellationToken cancellationToken) =>
        Ok(await sheets.SetBaseValueAsync(ReadSubject(), campaignId, characterId, fieldId, request, cancellationToken));

    [HttpDelete("{characterId:guid}/base-values/{fieldId:guid}")]
    public async Task<ActionResult<CharacterSheetEnvelope>> DeleteBaseValue(
        int campaignId,
        Guid characterId,
        Guid fieldId,
        [FromQuery, System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.Range(1, long.MaxValue)] long? expectedRevision,
        CancellationToken cancellationToken) =>
        Ok(await sheets.DeleteBaseValueAsync(ReadSubject(), campaignId, characterId, fieldId, expectedRevision!.Value, cancellationToken));

    [HttpGet("{characterId:guid}/assignments")]
    public async Task<ActionResult<IReadOnlyList<CharacterAssignmentDto>>> Assignments(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Ok(await sheets.ListAssignmentsAsync(ReadSubject(), campaignId, characterId, cancellationToken));

    [HttpPut("{characterId:guid}/assignments/{userId:int}")]
    public async Task<IActionResult> UpsertAssignment(int campaignId, Guid characterId, int userId, [FromBody] AssignmentRequest request, CancellationToken cancellationToken)
    {
        var (assignment, created) = await sheets.UpsertAssignmentAsync(ReadSubject(), campaignId, characterId, userId, request, cancellationToken);
        if (!created)
            return Ok(assignment);
        return StatusCode(StatusCodes.Status201Created, assignment);
    }

    [HttpDelete("{characterId:guid}/assignments/{userId:int}")]
    public async Task<IActionResult> DeleteAssignment(
        int campaignId,
        Guid characterId,
        int userId,
        [FromQuery, System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.Range(1, long.MaxValue)] long? expectedRevision,
        CancellationToken cancellationToken)
    {
        await sheets.DeleteAssignmentAsync(ReadSubject(), campaignId, characterId, userId, expectedRevision!.Value, cancellationToken);
        return NoContent();
    }

    private Subject? ReadSubject() => SubjectReader.Parse(Request.Headers["X-Subject"].FirstOrDefault());
}
