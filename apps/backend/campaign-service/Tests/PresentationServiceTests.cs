using System.Text.Json;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Views;

namespace CampaignService.Tests;

public class PresentationServiceTests
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);

    [Fact]
    public async Task DefinitionReadPolicyAppliesToPresentationReads()
    {
        var fixture = SheetServiceTests.CreateFixture(membersCanReadDefinitions: false);
        var views = new ViewService(fixture.Resources, fixture.Content, fixture.Sheets,
            new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets));
        var service = new PresentationService(fixture.Resources, fixture.Content, fixture.Sheets, views);

        var denied = await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(new Subject(SubjectType.User, 200), 7, default));

        Assert.Equal(403, denied.StatusCode);
        Assert.Equal(0, fixture.Content.ReadCount);
    }

    [Fact]
    public async Task MissingConfigReadsEmptyWithoutWriteAndExpectedZeroInsertsCanonicalExtensibleKeys()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var views = new ViewService(fixture.Resources, fixture.Content, fixture.Sheets,
            new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets));
        var service = new PresentationService(fixture.Resources, fixture.Content, fixture.Sheets, views);
        var before = fixture.Content.WriteCount;

        var empty = await service.GetAsync(Admin, 7, default);

        Assert.Equal(0, empty.ContentRevision);
        Assert.Empty(empty.Defaults);
        Assert.Empty(empty.ContextParams);
        Assert.Equal(before, fixture.Content.WriteCount);

        var id = Guid.NewGuid();
        await views.CreateAsync(Admin, 7, new ViewCreateRequest { RequestId = id, Name = "View", Roots = [] }, default);
        var created = await service.UpdateAsync(Admin, 7, new PresentationUpdateRequest
        {
            ExpectedRevision = 0,
            Defaults = new Dictionary<string, string> { ["future/custom-context"] = id.ToString("D") },
            ContextParams = new Dictionary<string, JsonElement>
            {
                ["future/custom-context"] = Json("{\"unknown\":[1,true,null]}"),
                ["future/unconfigured-context"] = Json("null")
            }
        }, default);

        Assert.Equal(1, created.ContentRevision);
        Assert.Equal(id.ToString("N"), created.Defaults["future/custom-context"]);
        Assert.Equal(JsonValueKind.Null, created.ContextParams["future/unconfigured-context"].ValueKind);
        var resolved = await service.ResolveAsync(Admin, 7, "future/custom-context", default);
        Assert.Equal("future/custom-context", resolved.ContextKey);
        Assert.Equal(id, resolved.ViewMetadata.Id);
        Assert.Equal(1, resolved.ContentRevision);
        Assert.Equal(JsonValueKind.Array, resolved.ContextParams!.Value.GetProperty("unknown").ValueKind);
    }

    [Fact]
    public async Task DuplicateInsertStaleRevisionAndInvalidViewReferenceReturnDomainConflicts()
    {
        var fixture = SheetServiceTests.CreateFixture();
        var views = new ViewService(fixture.Resources, fixture.Content, fixture.Sheets,
            new ComputedSheetService(fixture.Resources, fixture.Content, fixture.Sheets));
        var service = new PresentationService(fixture.Resources, fixture.Content, fixture.Sheets, views);
        var foreignId = Guid.NewGuid();
        fixture.Resources.Views.Add(new Tdn.Campaigns.Sheets.ViewMetadata { Id = foreignId, CampaignId = 8, Name = "Foreign" });
        var invalid = await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(Admin, 7, new PresentationUpdateRequest
        {
            ExpectedRevision = 0, Defaults = new Dictionary<string, string> { ["custom"] = foreignId.ToString("N") },
            ContextParams = new Dictionary<string, JsonElement>()
        }, default));
        Assert.Equal("invalid_view", invalid.Code);

        var first = new PresentationUpdateRequest { ExpectedRevision = 0, Defaults = new(), ContextParams = new() };
        await service.UpdateAsync(Admin, 7, first, default);
        var collision = await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(Admin, 7, first, default));
        Assert.Equal(409, collision.StatusCode);
        await service.UpdateAsync(Admin, 7, new PresentationUpdateRequest { ExpectedRevision = 1, Defaults = new(), ContextParams = new() }, default);
        var stale = await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(Admin, 7,
            new PresentationUpdateRequest { ExpectedRevision = 1, Defaults = new(), ContextParams = new() }, default));
        Assert.Equal(409, stale.StatusCode);
    }

    private static JsonElement Json(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
