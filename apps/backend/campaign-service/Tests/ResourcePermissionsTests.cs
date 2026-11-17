using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Http;
using Tdn.Campaigns.Sheets;
using CampaignApplicationService = Tdn.Campaigns.Campaigns.CampaignService;

namespace CampaignService.Tests;

public sealed class ResourcePermissionsTests
{
    private static readonly Subject Admin = new(SubjectType.Admin, 1);
    private static readonly Subject Group = new(SubjectType.Group, 7);
    private static readonly Subject CampaignAdmin = new(SubjectType.User, 100);
    private static readonly Subject Member = new(SubjectType.User, 200);

    [Fact]
    public async Task CampaignPermissionsUseCurrentMembershipAndCampaignScope()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var service = new CampaignApplicationService(fixture.Campaigns);

        Assert.Equal(new ResourcePermissionsDto(true, true, true), await service.GetPermissionsAsync(CampaignAdmin, 7, default));
        Assert.Equal(new ResourcePermissionsDto(true, false, false), await service.GetPermissionsAsync(Member, 7, default));
        Assert.Equal(new ResourcePermissionsDto(true, true, true), await service.GetPermissionsAsync(Group, 7, default));
        Assert.Equal(new ResourcePermissionsDto(true, true, true), await service.GetPermissionsAsync(Admin, 7, default));
        await AssertStatus(404, () => service.GetPermissionsAsync(new Subject(SubjectType.User, 999), 7, default));
        await AssertStatus(404, () => service.GetPermissionsAsync(new Subject(SubjectType.Group, 8), 7, default));
        await AssertStatus(404, () => service.GetPermissionsAsync(Admin, 999, default));
        await AssertInvalidSubjects(service);
    }

    [Fact]
    public async Task CharacterPermissionsUseOnlyCurrentSubjectAssignmentAndCurrentCampaignAdmin()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var character = SeedCharacter(fixture, 7);
        fixture.Resources.Assignments.Add(new CharacterAssignment { CampaignId = 7, CharacterId = character.Id, UserId = 200, CanWrite = false });
        fixture.Resources.Assignments.Add(new CharacterAssignment { CampaignId = 7, CharacterId = character.Id, UserId = 201, CanWrite = true });
        fixture.Campaigns.SeedMember(7, 201, false);
        fixture.Resources.SeedMember(7, 201);
        fixture.Campaigns.SeedCampaign(8);
        fixture.Campaigns.SeedMember(8, 200, false);
        fixture.Resources.SeedMember(8, 200);

        Assert.Equal(new ResourcePermissionsDto(true, false, false), await fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));
        fixture.Resources.Assignments.Single(x => x.UserId == 200).CanWrite = true;
        Assert.Equal(new ResourcePermissionsDto(true, true, false), await fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));
        Assert.Equal(new ResourcePermissionsDto(true, true, true), await fixture.Sheets.GetCharacterPermissionsAsync(CampaignAdmin, 7, character.Id, default));
        Assert.Equal(new ResourcePermissionsDto(true, true, true), await fixture.Sheets.GetCharacterPermissionsAsync(Group, 7, character.Id, default));
        Assert.Equal(new ResourcePermissionsDto(true, true, true), await fixture.Sheets.GetCharacterPermissionsAsync(Admin, 7, character.Id, default));

        var unassigned = SeedCharacter(fixture, 7);
        await AssertStatus(403, () => fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, unassigned.Id, default));
        await AssertStatus(403, () => fixture.Sheets.GetCharacterPermissionsAsync(null, 7, character.Id, default));
        await AssertStatus(403, () => fixture.Sheets.GetCharacterPermissionsAsync(new Subject((SubjectType)99, 1), 7, character.Id, default));
        await AssertStatus(404, () => fixture.Sheets.GetCharacterPermissionsAsync(new Subject(SubjectType.User, 202), 8, character.Id, default));
        await AssertStatus(404, () => fixture.Sheets.GetCharacterPermissionsAsync(Member, 8, character.Id, default));
        await AssertStatus(404, () => fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, Guid.NewGuid(), default));
    }

    [Fact]
    public async Task PermissionReadsReflectRevocationAndAdminChangesWithoutMongoAccess()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var character = SeedCharacter(fixture, 7);
        var assignment = new CharacterAssignment { CampaignId = 7, CharacterId = character.Id, UserId = 200, CanWrite = true };
        fixture.Resources.Assignments.Add(assignment);
        var readCount = fixture.Content.ReadCount;
        var writeCount = fixture.Content.WriteCount;
        var characterRevision = character.MetadataRevision;
        var campaignRevision = fixture.Campaigns.Campaigns.Single(x => x.Id == 7).MetadataRevision;

        Assert.Equal(new ResourcePermissionsDto(true, true, false), await fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));
        assignment.CanWrite = false;
        Assert.Equal(new ResourcePermissionsDto(true, false, false), await fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));
        fixture.Resources.Assignments.Remove(assignment);
        await AssertStatus(403, () => fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));

        fixture.Resources.Assignments.Add(assignment);
        fixture.Campaigns.Members.Single(x => x.UserId == 200).IsAdmin = true;
        Assert.Equal(new ResourcePermissionsDto(true, true, true), await fixture.CampaignsService().GetPermissionsAsync(Member, 7, default));
        Assert.Equal(new ResourcePermissionsDto(true, true, true), await fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));
        fixture.Campaigns.Members.Single(x => x.UserId == 200).IsAdmin = false;
        Assert.Equal(new ResourcePermissionsDto(true, false, false), await fixture.CampaignsService().GetPermissionsAsync(Member, 7, default));
        Assert.Equal(new ResourcePermissionsDto(true, false, false), await fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));

        fixture.Campaigns.Members.RemoveAll(x => x.UserId == 200);
        await AssertStatus(404, () => fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));
        Assert.Equal(readCount, fixture.Content.ReadCount);
        Assert.Equal(writeCount, fixture.Content.WriteCount);
        Assert.Equal(characterRevision, character.MetadataRevision);
        Assert.Equal(campaignRevision, fixture.Campaigns.Campaigns.Single(x => x.Id == 7).MetadataRevision);
    }

    [Fact]
    public async Task PermissionsDoNotOpenGrantListsAndAgreeWithExistingWriteChecks()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var character = SeedCharacter(fixture, 7);
        fixture.Resources.Assignments.Add(new CharacterAssignment { CampaignId = 7, CharacterId = character.Id, UserId = 200, CanWrite = true });

        Assert.Equal(new ResourcePermissionsDto(true, false, false), await fixture.CampaignsService().GetPermissionsAsync(Member, 7, default));
        Assert.Equal(new ResourcePermissionsDto(true, true, false), await fixture.Sheets.GetCharacterPermissionsAsync(Member, 7, character.Id, default));
        await AssertStatus(403, () => fixture.CampaignsService().ListMembersAsync(Member, 7, default));
        await AssertStatus(403, () => fixture.Sheets.ListAssignmentsAsync(Member, 7, character.Id, default));
        Assert.Equal(2, (await fixture.CampaignsService().ListMembersAsync(CampaignAdmin, 7, default)).Count);
        Assert.Single(await fixture.Sheets.ListAssignmentsAsync(CampaignAdmin, 7, character.Id, default));
        var updated = await fixture.Sheets.UpdateCharacterAsync(Member, 7, character.Id,
            new CharacterUpdateRequest { Name = "Updated", Importance = Importance.Secondary, ExpectedRevision = 1 }, default);
        Assert.Equal(2, updated.MetadataRevision);

        fixture.Resources.Assignments.Single().CanWrite = false;
        await AssertStatus(403, () => fixture.Sheets.UpdateCharacterAsync(Member, 7, character.Id,
            new CharacterUpdateRequest { Name = "Denied", Importance = Importance.Secondary, ExpectedRevision = 2 }, default));
        await AssertStatus(403, () => fixture.CampaignsService().RenameAsync(Member, 7,
            new RenameCampaignRequest { Name = "Denied", ExpectedRevision = 1 }, default));
    }

    [Fact]
    public async Task ControllersReturnNoStorePermissionsForHeaderSubjectOnly()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var character = SeedCharacter(fixture, 7);
        fixture.Resources.Assignments.Add(new CharacterAssignment { CampaignId = 7, CharacterId = character.Id, UserId = 200, CanWrite = false });
        var campaignController = new CampaignsController(fixture.CampaignsService());
        var characterController = new CharactersController(fixture.Sheets, null!, null!);
        SetSubject(campaignController, Member);
        SetSubject(characterController, Member);

        AssertNoStore(typeof(CampaignsController).GetMethod(nameof(CampaignsController.Permissions))!);
        AssertNoStore(typeof(CharactersController).GetMethod(nameof(CharactersController.Permissions))!);
        Assert.Equal(new[] { "campaignId", "cancellationToken" }, typeof(CampaignsController).GetMethod(nameof(CampaignsController.Permissions))!.GetParameters().Select(x => x.Name));
        Assert.Equal(new[] { "campaignId", "characterId", "cancellationToken" }, typeof(CharactersController).GetMethod(nameof(CharactersController.Permissions))!.GetParameters().Select(x => x.Name));
        AssertControllerResult(await campaignController.Permissions(7, default), new ResourcePermissionsDto(true, false, false));
        AssertControllerResult(await characterController.Permissions(7, character.Id, default), new ResourcePermissionsDto(true, false, false));
    }

    [Fact]
    public void PermissionsAndExistingDtosSerializeWithoutCapabilityExpansion()
    {
        var permissions = JsonSerializer.SerializeToElement(new ResourcePermissionsDto(true, false, false), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal(new[] { "canManageAccess", "canRead", "canWrite" }, permissions.EnumerateObject().Select(x => x.Name).Order().ToArray());
        Assert.All(permissions.EnumerateObject(), property => Assert.Contains(property.Value.ValueKind, new[] { JsonValueKind.True, JsonValueKind.False }));
        Assert.Equal(JsonValueKind.True, permissions.GetProperty("canRead").ValueKind);
        Assert.Equal(JsonValueKind.False, permissions.GetProperty("canWrite").ValueKind);
        Assert.Equal(JsonValueKind.False, permissions.GetProperty("canManageAccess").ValueKind);

        AssertNoPermissions(JsonSerializer.Serialize(new CampaignDto(7, "Campaign", 1), new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        AssertNoPermissions(JsonSerializer.Serialize(new CharacterMetadataDto(Guid.NewGuid(), 7, Guid.NewGuid(), "Character", Importance.Background, 1), new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        AssertNoPermissions(JsonSerializer.Serialize(new CharacterSheetEnvelope(1, 1, string.Empty, []), new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    private static CharacterMetadata SeedCharacter(SheetServiceTests.Fixture fixture, int campaignId)
    {
        var template = new TemplateMetadata { Id = Guid.NewGuid(), CampaignId = campaignId, Name = "Template" };
        fixture.Resources.Templates.Add(template);
        var character = new CharacterMetadata { Id = Guid.NewGuid(), CampaignId = campaignId, TemplateId = template.Id, Name = "Character" };
        fixture.Resources.Characters.Add(character);
        return character;
    }

    private static async Task AssertInvalidSubjects(CampaignApplicationService service)
    {
        foreach (var value in new string?[] { null, "", "{", "{}", "{\"Type\":99,\"Id\":1}" })
            await AssertStatus(403, () => service.GetPermissionsAsync(SubjectReader.Parse(value), 7, default));
    }

    private static async Task AssertStatus(int status, Func<Task> action)
    {
        var exception = await Assert.ThrowsAsync<DomainException>(action);
        Assert.Equal(status, exception.StatusCode);
    }

    private static void SetSubject(ControllerBase controller, Subject subject)
    {
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.HttpContext.Request.Headers["X-Subject"] = JsonSerializer.Serialize(subject);
    }

    private static void AssertNoStore(System.Reflection.MethodInfo action)
    {
        var attribute = Assert.Single(action.GetCustomAttributes(typeof(ResponseCacheAttribute), false));
        var responseCache = Assert.IsType<ResponseCacheAttribute>(attribute);
        Assert.True(responseCache.NoStore);
        Assert.Equal(ResponseCacheLocation.None, responseCache.Location);
    }

    private static void AssertControllerResult<T>(ActionResult<T> action, ResourcePermissionsDto expected)
    {
        var result = Assert.IsType<OkObjectResult>(action.Result);
        Assert.Equal(expected, Assert.IsType<ResourcePermissionsDto>(result.Value));
    }

    private static void AssertNoPermissions(string json)
    {
        using var document = JsonDocument.Parse(json);
        Assert.DoesNotContain(document.RootElement.EnumerateObject(), property => property.Name.Contains("permission", StringComparison.OrdinalIgnoreCase) || property.Name.Contains("capabilit", StringComparison.OrdinalIgnoreCase));
    }
}

internal static class ResourcePermissionsTestExtensions
{
    internal static CampaignApplicationService CampaignsService(this SheetServiceTests.Fixture fixture) => new(fixture.Campaigns);
}
