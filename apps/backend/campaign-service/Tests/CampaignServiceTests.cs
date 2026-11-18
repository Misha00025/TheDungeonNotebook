using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public class CampaignServiceTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("invalid")]
    [InlineData("null")]
    [InlineData("{}")]
    public async Task InvalidSubjectCannotUseProtectedOperations(string? value)
    {
        var service = new Tdn.Campaigns.Campaigns.CampaignService(new FakeCampaignStore());

        var exception = await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(SubjectReader.Parse(value), default));

        Assert.Equal(403, exception.StatusCode);
    }

    [Fact]
    public async Task GroupCanReadOnlyItsCampaign()
    {
        var store = new FakeCampaignStore();
        store.SeedCampaign(11);
        store.SeedCampaign(12);
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);

        Assert.Equal(11, (await service.GetAsync(new Subject(SubjectType.Group, 11), 11, default)).Id);
        var exception = await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(new Subject(SubjectType.Group, 11), 12, default));
        Assert.Equal(404, exception.StatusCode);
    }

    [Fact]
    public async Task AdminGetsNotFoundForMissingCampaign()
    {
        var service = new Tdn.Campaigns.Campaigns.CampaignService(new FakeCampaignStore());

        var exception = await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(new Subject(SubjectType.Admin, 1), 700, default));

        Assert.Equal(404, exception.StatusCode);
    }

    [Fact]
    public async Task UnknownSubjectTypeIsForbiddenBeforeStoreAccess()
    {
        var store = new FakeCampaignStore();
        store.SeedCampaign(31);
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);

        var exception = await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(new Subject((SubjectType)99, 1), 31, default));

        Assert.Equal(403, exception.StatusCode);
        Assert.Equal(0, store.CampaignReads);
    }

    [Fact]
    public async Task UserListContainsOnlyMembershipCampaigns()
    {
        var store = new FakeCampaignStore();
        store.SeedCampaign(1);
        store.SeedCampaign(2);
        store.SeedMember(1, 44, false);
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);

        var result = await service.ListAsync(new Subject(SubjectType.User, 44), default);

        Assert.Equal(new[] { 1 }, result.Select(x => x.Id));
    }

    [Fact]
    public async Task UserCreatesOwnCampaignAsAdminAndCannotAssignAnotherUser()
    {
        var store = new FakeCampaignStore();
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);
        var requestId = Guid.NewGuid();

        var created = await service.CreateAsync(new Subject(SubjectType.User, -12), new CreateCampaignRequest { Name = "Name", RequestId = requestId }, default);

        Assert.Equal(1, created.MetadataRevision);
        Assert.True(store.Members.Single().IsAdmin);
        Assert.Equal(-12, store.Members.Single().UserId);
        var exception = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(
            new Subject(SubjectType.User, 12), new CreateCampaignRequest { Name = "Name", RequestId = Guid.NewGuid(), AdministratorUserId = 13 }, default));
        Assert.Equal(403, exception.StatusCode);
    }

    [Fact]
    public async Task AdminMustSelectInitialAdministrator()
    {
        var store = new FakeCampaignStore();
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);
        var missing = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(
            new Subject(SubjectType.Admin, 1), new CreateCampaignRequest { Name = "Name", RequestId = Guid.NewGuid() }, default));
        Assert.Equal(400, missing.StatusCode);

        var created = await service.CreateAsync(new Subject(SubjectType.Admin, 1), new CreateCampaignRequest
        {
            Name = "Name",
            RequestId = Guid.NewGuid(),
            AdministratorUserId = -4
        }, default);

        Assert.Equal(created.Id, store.Members.Single().CampaignId);
        Assert.Equal(-4, store.Members.Single().UserId);
        Assert.True(store.Members.Single().IsAdmin);
    }

    [Fact]
    public async Task GroupCannotCreateOrListUnscopedCampaigns()
    {
        var service = new Tdn.Campaigns.Campaigns.CampaignService(new FakeCampaignStore());
        var group = new Subject(SubjectType.Group, 2);

        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(group, default))).StatusCode);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(
            group, new CreateCampaignRequest { Name = "X", RequestId = Guid.NewGuid() }, default))).StatusCode);
    }

    [Fact]
    public async Task RenameRequiresAdminAndUsesRevisionCompareAndSwap()
    {
        var store = new FakeCampaignStore();
        store.SeedCampaign(3);
        store.SeedMember(3, 5, false);
        store.SeedMember(3, 6, true);
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);

        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => service.RenameAsync(
            new Subject(SubjectType.User, 5), 3, new RenameCampaignRequest { Name = "New", ExpectedRevision = 1 }, default))).StatusCode);
        Assert.Equal(409, (await Assert.ThrowsAsync<DomainException>(() => service.RenameAsync(
            new Subject(SubjectType.User, 6), 3, new RenameCampaignRequest { Name = "New", ExpectedRevision = 2 }, default))).StatusCode);
        var renamed = await service.RenameAsync(new Subject(SubjectType.User, 6), 3, new RenameCampaignRequest { Name = "New", ExpectedRevision = 1 }, default);
        Assert.Equal(2, renamed.MetadataRevision);
        Assert.Equal("New", renamed.Name);
    }

    [Fact]
    public async Task MemberInsertUpdateDeleteAndAccessUseCurrentMembership()
    {
        var store = new FakeCampaignStore();
        store.SeedCampaign(8);
        store.SeedMember(8, 1, true);
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);
        var admin = new Subject(SubjectType.User, 1);

        var inserted = await service.UpsertMemberAsync(admin, 8, -3, new UpsertCampaignMemberRequest { IsAdmin = false, ExpectedRevision = 0 }, default);
        Assert.True(inserted.Created);
        Assert.Equal(1, inserted.Member.MetadataRevision);
        Assert.Equal(409, (await Assert.ThrowsAsync<DomainException>(() => service.UpsertMemberAsync(
            admin, 8, -3, new UpsertCampaignMemberRequest { IsAdmin = true, ExpectedRevision = 0 }, default))).StatusCode);
        var updated = await service.UpsertMemberAsync(admin, 8, -3, new UpsertCampaignMemberRequest { IsAdmin = true, ExpectedRevision = 1 }, default);
        Assert.False(updated.Created);
        Assert.Equal(2, updated.Member.MetadataRevision);
        await service.DeleteMemberAsync(admin, 8, -3, 2, default);
        Assert.Equal(404, (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(new Subject(SubjectType.User, -3), 8, default))).StatusCode);
    }

    [Fact]
    public async Task CreationRequestIsUniqueAndStatusRequiresCreatorAndCurrentAccess()
    {
        var store = new FakeCampaignStore();
        var service = new Tdn.Campaigns.Campaigns.CampaignService(store);
        var requestId = Guid.NewGuid();
        var user = new Subject(SubjectType.User, 71);
        var created = await service.CreateAsync(user, new CreateCampaignRequest { Name = "A", RequestId = requestId }, default);
        var second = await service.CreateAsync(user, new CreateCampaignRequest { Name = "Second", RequestId = Guid.NewGuid() }, default);

        var firstRoot = store.Campaigns.Single(x => x.Id == created.Id);
        Assert.NotNull(firstRoot.Template);
        Assert.Equal(firstRoot.Id, firstRoot.Template!.CampaignId);
        Assert.Same(firstRoot, firstRoot.Template.Campaign);
        Assert.NotNull(store.Campaigns.Single(x => x.Id == second.Id).Template);
        Assert.Equal(2, store.Campaigns.Count(x => x.Template is not null));

        Assert.Equal(created.Id, (await service.GetCreationStatusAsync(user, requestId, default)).ResourceId);
        var duplicate = await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(user,
            new CreateCampaignRequest { Name = "B", RequestId = requestId }, default));
        Assert.Equal("creation_already_published", duplicate.Code);
        Assert.Equal(2, store.Campaigns.Count(x => x.Template is not null));
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(new Subject(SubjectType.User, 72),
            new CreateCampaignRequest { Name = "B", RequestId = requestId }, default))).StatusCode);
        Assert.Equal(403, (await Assert.ThrowsAsync<DomainException>(() => service.GetCreationStatusAsync(new Subject(SubjectType.Group, 1), requestId, default))).StatusCode);
        store.Members.Clear();
        Assert.Equal(404, (await Assert.ThrowsAsync<DomainException>(() => service.GetCreationStatusAsync(user, requestId, default))).StatusCode);
    }

    private sealed class FakeCampaignStore : ICampaignStore
    {
        private int _nextId = 1;
        public List<Campaign> Campaigns { get; } = [];
        public List<CampaignMember> Members { get; } = [];
        public int CampaignReads { get; private set; }

        public void SeedCampaign(int id)
        {
            var campaign = new Campaign { Id = id, Name = $"Campaign {id}", CreationRequestId = Guid.NewGuid(), CreatedByType = SubjectType.User, CreatedById = 1 };
            campaign.Template = new TemplateMetadata { CampaignId = id, Campaign = campaign, Name = campaign.Name };
            Campaigns.Add(campaign);
            _nextId = Math.Max(_nextId, id + 1);
        }

        public void SeedMember(int campaignId, int userId, bool isAdmin) => Members.Add(new CampaignMember { CampaignId = campaignId, UserId = userId, IsAdmin = isAdmin });
        public Task<Campaign?> GetCampaignAsync(int campaignId, CancellationToken cancellationToken)
        {
            CampaignReads++;
            return Task.FromResult(Campaigns.SingleOrDefault(x => x.Id == campaignId));
        }
        public Task<IReadOnlyList<Campaign>> GetAllCampaignsAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<Campaign>>(Campaigns.ToArray());
        public Task<IReadOnlyList<Campaign>> GetCampaignsForUserAsync(int userId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<Campaign>>(Campaigns.Where(c => Members.Any(m => m.CampaignId == c.Id && m.UserId == userId)).ToArray());
        public Task<Campaign?> GetCampaignForUserAsync(int campaignId, int userId, CancellationToken cancellationToken) => Task.FromResult(Campaigns.SingleOrDefault(c => c.Id == campaignId && Members.Any(m => m.CampaignId == c.Id && m.UserId == userId)));
        public Task<Campaign?> GetCampaignByRequestAsync(Guid requestId, CancellationToken cancellationToken) => Task.FromResult(Campaigns.SingleOrDefault(x => x.CreationRequestId == requestId));
        public Task<CampaignMember?> GetMemberAsync(int campaignId, int userId, CancellationToken cancellationToken) => Task.FromResult(Members.SingleOrDefault(x => x.CampaignId == campaignId && x.UserId == userId));
        public Task<IReadOnlyList<CampaignMember>> GetMembersAsync(int campaignId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<CampaignMember>>(Members.Where(x => x.CampaignId == campaignId).ToArray());

        public Task<Campaign> CreateAsync(Campaign campaign, int administratorUserId, CancellationToken cancellationToken)
        {
            if (Campaigns.Any(x => x.CreationRequestId == campaign.CreationRequestId))
                throw new DuplicateCreationRequestException();
            campaign.Id = _nextId++;
            campaign.MetadataRevision = 1;
            campaign.Template ??= new TemplateMetadata { Campaign = campaign, CampaignId = campaign.Id, Name = campaign.Name };
            campaign.Template.Campaign = campaign;
            campaign.Template.CampaignId = campaign.Id;
            Campaigns.Add(campaign);
            SeedMember(campaign.Id, administratorUserId, true);
            return Task.FromResult(campaign);
        }

        public Task<bool> RenameAsync(int campaignId, string name, long expectedRevision, CancellationToken cancellationToken)
        {
            var campaign = Campaigns.SingleOrDefault(x => x.Id == campaignId && x.MetadataRevision == expectedRevision);
            if (campaign is null)
                return Task.FromResult(false);
            campaign.Name = name;
            campaign.MetadataRevision++;
            return Task.FromResult(true);
        }

        public Task<MemberUpdateResult> UpsertMemberAsync(int campaignId, int userId, bool isAdmin, long expectedRevision, CancellationToken cancellationToken)
        {
            var member = Members.SingleOrDefault(x => x.CampaignId == campaignId && x.UserId == userId);
            if (expectedRevision == 0)
            {
                if (member is not null)
                    return Task.FromResult(new MemberUpdateResult(null, true));
                SeedMember(campaignId, userId, isAdmin);
                return Task.FromResult(new MemberUpdateResult(1, true));
            }
            if (member is null)
                return Task.FromResult(new MemberUpdateResult(null, false));
            if (member.MetadataRevision != expectedRevision)
                return Task.FromResult(new MemberUpdateResult(null, true));
            member.IsAdmin = isAdmin;
            member.MetadataRevision++;
            return Task.FromResult(new MemberUpdateResult(member.MetadataRevision, true));
        }

        public Task<bool> DeleteMemberAsync(int campaignId, int userId, long expectedRevision, CancellationToken cancellationToken)
        {
            var member = Members.SingleOrDefault(x => x.CampaignId == campaignId && x.UserId == userId && x.MetadataRevision == expectedRevision);
            if (member is null)
                return Task.FromResult(false);
            Members.Remove(member);
            return Task.FromResult(true);
        }
    }
}
