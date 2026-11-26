using Microsoft.Extensions.Options;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.WorldContent;

namespace CampaignService.Tests;

public sealed class WorldMaterialServiceTests
{
    [Fact]
    public async Task CampaignMasterPublishesPrivateLocationForMemberWithExactMarkdownBody()
    {
        var campaignFixture = SheetServiceTests.CreateFixture();
        var store = new FakeWorldMaterialStore();
        var root = Path.Combine(Path.GetTempPath(), "tdn-world-material-tests-" + Guid.NewGuid().ToString("N"));
        var service = new WorldMaterialService(
            new Tdn.Campaigns.Campaigns.CampaignService(campaignFixture.Campaigns),
            store,
            Options.Create(new WorldContentOptions { RootPath = root }));
        var master = new Subject(SubjectType.User, 100);
        var member = new Subject(SubjectType.User, 200);
        var id = Guid.NewGuid();
        const string body = "# The Ashen Keep\n\n## Outer Wall\n\nA black stone curtain.\n\n### Gatehouse\n\nThe portcullis is sealed.";

        try
        {
            var created = await service.CreateAsync(master, 7, "locations", new WorldMaterialCreateRequest
            {
                RequestId = id,
                Title = "The Ashen Keep",
                Description = "A fortress above the pass.",
                Tags = ["fortress"],
                Body = body
            }, default);

            Assert.Equal(id, created.Material.Id);
            Assert.False(created.Material.IsPublished);
            Assert.Equal(body, await File.ReadAllTextAsync(Path.Combine(root, "7", id.ToString("N") + ".md")));
            Assert.Empty(await service.ListAsync(member, 7, "locations", null, default));
            Assert.Equal(404, (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(member, 7, "locations", id, default))).StatusCode);

            var published = await service.UpdateAsync(master, 7, "locations", id, new WorldMaterialUpdateRequest
            {
                Title = "The Ashen Keep",
                Description = "A fortress above the pass.",
                Tags = ["fortress"],
                IsPublished = true,
                ExpectedRevision = 1
            }, default);

            Assert.True(published.IsPublished);
            var visible = await service.GetAsync(member, 7, "locations", id, default);
            Assert.Equal("The Ashen Keep", visible.Title);
            Assert.Equal("A fortress above the pass.", visible.Description);
            Assert.Equal(new[] { "fortress" }, visible.Tags);
            Assert.True(visible.IsPublished);
            Assert.Equal(body, (await service.GetBodyAsync(member, 7, "locations", id, default)).Body);
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    private sealed class FakeWorldMaterialStore : IWorldMaterialStore
    {
        private readonly Dictionary<Guid, WorldMaterial> materials = [];

        public Task<IReadOnlyList<WorldMaterial>> ListAsync(int campaignId, string kind, string? tag, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<WorldMaterial>>(materials.Values
                .Where(x => x.CampaignId == campaignId && x.Kind == kind)
                .Where(x => tag is null || System.Text.Json.JsonSerializer.Deserialize<string[]>(x.Tags)!.Contains(tag, StringComparer.Ordinal))
                .ToArray());

        public Task<WorldMaterial?> GetAsync(int campaignId, string kind, Guid id, CancellationToken ct) =>
            Task.FromResult(materials.TryGetValue(id, out var material) && material.CampaignId == campaignId && material.Kind == kind ? material : null);

        public Task<WorldMaterial> CreateAsync(WorldMaterial material, CancellationToken ct)
        {
            materials.Add(material.Id, material);
            return Task.FromResult(material);
        }

        public Task<bool> UpdateAsync(int campaignId, string kind, Guid id, string title, string description, string tags, bool isPublished, long expectedRevision, CancellationToken ct)
        {
            if (!materials.TryGetValue(id, out var material) || material.CampaignId != campaignId || material.Kind != kind || material.MetadataRevision != expectedRevision)
                return Task.FromResult(false);
            material.Title = title;
            material.Description = description;
            material.Tags = tags;
            material.IsPublished = isPublished;
            material.MetadataRevision++;
            return Task.FromResult(true);
        }

        public Task<bool> DeleteAsync(int campaignId, string kind, Guid id, long expectedRevision, CancellationToken ct)
        {
            if (!materials.TryGetValue(id, out var material) || material.CampaignId != campaignId || material.Kind != kind || material.MetadataRevision != expectedRevision)
                return Task.FromResult(false);
            return Task.FromResult(materials.Remove(id));
        }
    }
}
