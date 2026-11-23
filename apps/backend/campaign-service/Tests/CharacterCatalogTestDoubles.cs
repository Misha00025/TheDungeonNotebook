using System.Text.Json;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

internal sealed class CharacterCatalogTestFixture<TCatalog> where TCatalog : ICatalogType
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);

    private CharacterCatalogTestFixture(SheetServiceTests.Fixture sheets)
    {
        Sheets = sheets;
        CatalogStore = new FakeCatalogStore<TCatalog>();
        Store = new FakeCharacterCatalogStore<TCatalog>(CatalogStore, (campaignId, characterId) =>
            Sheets.Resources.Characters.Any(x => x.CampaignId == campaignId && x.Id == characterId), CatalogStore);
        Catalog = new CatalogService<TCatalog>(new Tdn.Campaigns.Campaigns.CampaignService(Sheets.Campaigns), CatalogStore, Sheets.Content, Store);
        Service = new CharacterCatalogService<TCatalog>(Sheets.Sheets, Catalog, CatalogStore, Store, Sheets.Content);
        Groups = new CatalogGroupService<TCatalog>(new Tdn.Campaigns.Campaigns.CampaignService(Sheets.Campaigns), Catalog, CatalogStore, Sheets.Content);
    }

    public SheetServiceTests.Fixture Sheets { get; }
    public FakeCatalogStore<TCatalog> CatalogStore { get; }
    public FakeCharacterCatalogStore<TCatalog> Store { get; }
    public CatalogService<TCatalog> Catalog { get; }
    public CharacterCatalogService<TCatalog> Service { get; }
    public CatalogGroupService<TCatalog> Groups { get; }

    public static CharacterCatalogTestFixture<TCatalog> Create() => new(SheetServiceTests.CreateFixture());
    public static CharacterCatalogTestFixture<TCatalog> Create(SheetServiceTests.Fixture shared) => new(shared);

    public async Task<Guid> AddCharacterAsync(int campaignId = 7, int userId = 200, bool canWrite = true)
    {
        if (campaignId != 7)
        {
            Sheets.Campaigns.SeedCampaign(campaignId);
            Sheets.Campaigns.SeedMember(campaignId, userId, false);
            Sheets.Resources.SeedMember(campaignId, userId);
        }
        var id = Guid.NewGuid();
        Sheets.Resources.Characters.Add(new CharacterMetadata { Id = id, CampaignId = campaignId, Name = "Test character" });
        if (userId != 0)
            await Sheets.Sheets.UpsertAssignmentAsync(Admin, campaignId, id, userId, new AssignmentRequest { CanWrite = canWrite, ExpectedRevision = 0 }, default);
        return id;
    }

    public Task<CatalogAttributeSchemaEnvelope> DefineSchemaAsync(params CatalogAttributeDefinitionInput[] definitions) =>
        Catalog.UpdateAttributesAsync(Admin, 7, new CatalogAttributesUpdateRequest { ExpectedRevision = 0, Definitions = definitions }, default);

    public Task<CatalogCreateResult> CreateDefinitionAsync(bool hidden = false, QuantityUnit? unit = null, bool allowNegative = false,
        CatalogAttributeValue[]? attributes = null, Subject? subject = null, string name = "Test definition", Guid? requestId = null) =>
        Catalog.CreateAsync(subject ?? Admin, 7, new CatalogCreateRequest
        {
            RequestId = requestId ?? Guid.NewGuid(), Name = name, IsHidden = hidden, QuantityUnit = TCatalog.HasQuantity ? unit ?? QuantityUnit.Whole : null,
            AllowNegative = TCatalog.HasQuantity && allowNegative, Description = "Definition description", Attributes = attributes ?? []
        }, default);

    internal static JsonElement Json(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    internal static CatalogAttributeDefinitionInput Definition(string title, string typeKey, ChoiceOption[]? options = null, Guid? id = null) => new()
    {
        Id = id, Title = title, TypeKey = typeKey, Options = options ?? []
    };

    internal static CatalogAttributeValue Value(Guid id, Guid attributeId, string json, AttributeEditLevel level = AttributeEditLevel.Character) =>
        new(id, attributeId, Json(json), level);
}

internal interface IFakeTransactionParticipant
{
    object CaptureState();
    void RestoreState(object state);
}

internal sealed class FakeCatalogStore<TCatalog> : ICatalogStore<TCatalog>, IFakeTransactionParticipant where TCatalog : ICatalogType
{
    public List<CatalogEntry<TCatalog>> Entries { get; } = [];
    public int CreateCount { get; private set; }
    public int UpdateCount { get; private set; }
    public bool UpdateReturnsFalse { get; set; }
    public Action<CatalogEntry<TCatalog>>? BeforeCreate { get; set; }

    public Task<IReadOnlyList<CatalogEntry<TCatalog>>> ListAsync(int campaignId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CatalogEntry<TCatalog>>>(Entries.Where(x => x.CampaignId == campaignId).OrderBy(x => x.Name).Select(Clone).ToArray());

    public Task<CatalogEntry<TCatalog>?> GetAsync(int campaignId, Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Entries.Where(x => x.CampaignId == campaignId && x.Id == id).Select(Clone).SingleOrDefault());

    public Task<CatalogEntry<TCatalog>> CreateAsync(CatalogEntry<TCatalog> entry, CancellationToken cancellationToken)
    {
        CreateCount++;
        BeforeCreate?.Invoke(entry);
        if (Entries.Any(x => x.CampaignId == entry.CampaignId && x.Id == entry.Id)) throw new DuplicateResourceException();
        Entries.Add(Clone(entry));
        return Task.FromResult(Clone(entry));
    }

    public Task<bool> UpdateAsync(int campaignId, Guid id, string name, bool isHidden, QuantityUnit? quantityUnit, bool allowNegative, long expectedRevision, CancellationToken cancellationToken)
    {
        UpdateCount++;
        if (UpdateReturnsFalse) return Task.FromResult(false);
        var entry = Entries.SingleOrDefault(x => x.CampaignId == campaignId && x.Id == id && x.MetadataRevision == expectedRevision);
        if (entry is null) return Task.FromResult(false);
        entry.Name = name;
        entry.IsHidden = isHidden;
        entry.QuantityUnit = quantityUnit;
        entry.AllowNegative = allowNegative;
        entry.MetadataRevision++;
        return Task.FromResult(true);
    }

    public object CaptureState() => Entries.Select(Clone).ToList();

    public void RestoreState(object state)
    {
        Entries.Clear();
        Entries.AddRange(((List<CatalogEntry<TCatalog>>)state).Select(Clone));
    }

    private static CatalogEntry<TCatalog> Clone(CatalogEntry<TCatalog> x) => new()
    {
        Id = x.Id, CampaignId = x.CampaignId, Name = x.Name, CreatorUserId = x.CreatorUserId,
        IsHidden = x.IsHidden, QuantityUnit = x.QuantityUnit, AllowNegative = x.AllowNegative, MetadataRevision = x.MetadataRevision
    };
}

internal sealed class FakeCharacterCatalogStore<TCatalog> : ICharacterCatalogStore<TCatalog>, IFakeTransactionParticipant where TCatalog : ICatalogType
{
    private readonly ICatalogStore<TCatalog> catalog;
    private readonly Func<int, Guid, bool> hasCharacter;
    private readonly IFakeTransactionParticipant[] otherParticipants;

    public FakeCharacterCatalogStore(ICatalogStore<TCatalog> catalog, Func<int, Guid, bool> hasCharacter, params IFakeTransactionParticipant[] otherParticipants)
    {
        this.catalog = catalog;
        this.hasCharacter = hasCharacter;
        this.otherParticipants = otherParticipants;
    }

    public List<CharacterCatalogEntry<TCatalog>> Entries { get; } = [];
    public List<CatalogAdditionReceipt<TCatalog>> Receipts { get; } = [];
    public List<string> LockOrder { get; } = [];
    public int TransactionCount { get; private set; }
    public int WriteAttempts { get; private set; }
    public bool InsideTransaction { get; private set; }
    public Action<CharacterCatalogEntry<TCatalog>>? BeforeRecordCreate { get; set; }

    public Task<IReadOnlyList<CharacterCatalogEntry<TCatalog>>> ListAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CharacterCatalogEntry<TCatalog>>>(Entries.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId).OrderBy(x => x.Id).Select(Clone).ToArray());

    public Task<IReadOnlyList<CharacterCatalogEntry<TCatalog>>> ListByCatalogEntryAsync(int campaignId, Guid catalogEntryId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CharacterCatalogEntry<TCatalog>>>(Entries.Where(x => x.CampaignId == campaignId && x.CatalogEntryId == catalogEntryId).OrderBy(x => x.CharacterId).ThenBy(x => x.Id).Select(Clone).ToArray());

    public Task<CharacterCatalogEntry<TCatalog>?> GetAsync(int campaignId, Guid characterId, Guid entryId, CancellationToken cancellationToken) =>
        Task.FromResult(Entries.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId).Select(Clone).SingleOrDefault());

    public Task<CharacterCatalogEntry<TCatalog>> CreateAsync(CharacterCatalogEntry<TCatalog> entry, CancellationToken cancellationToken)
    {
        RequireTransaction();
        WriteAttempts++;
        BeforeRecordCreate?.Invoke(entry);
        if (Entries.Any(x => x.CampaignId == entry.CampaignId && x.Id == entry.Id)) throw new DuplicateCharacterCatalogException();
        Entries.Add(Clone(entry));
        return Task.FromResult(Clone(entry));
    }

    public Task<bool> UpdateQuantityAsync(int campaignId, Guid characterId, Guid entryId, decimal? quantity, long expectedRevision, CancellationToken cancellationToken)
    {
        RequireTransaction();
        WriteAttempts++;
        var entry = Entries.SingleOrDefault(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId && x.MetadataRevision == expectedRevision);
        if (entry is null) return Task.FromResult(false);
        entry.Quantity = quantity;
        entry.MetadataRevision++;
        return Task.FromResult(true);
    }

    public Task<bool> DeleteAsync(int campaignId, Guid characterId, Guid entryId, long expectedRevision, CancellationToken cancellationToken)
    {
        RequireTransaction();
        WriteAttempts++;
        var entry = Entries.SingleOrDefault(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId && x.MetadataRevision == expectedRevision);
        if (entry is null) return Task.FromResult(false);
        Entries.Remove(entry);
        return Task.FromResult(true);
    }

    public Task<CatalogAdditionReceipt<TCatalog>?> GetAdditionAsync(int campaignId, Guid characterId, Guid requestId, CancellationToken cancellationToken) =>
        Task.FromResult(Receipts.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.RequestId == requestId).Select(Clone).SingleOrDefault());

    public Task<CatalogAdditionReceipt<TCatalog>> CreateAdditionAsync(CatalogAdditionReceipt<TCatalog> receipt, CancellationToken cancellationToken)
    {
        RequireTransaction();
        WriteAttempts++;
        if (Receipts.Any(x => x.CampaignId == receipt.CampaignId && x.CharacterId == receipt.CharacterId && x.RequestId == receipt.RequestId)) throw new DuplicateCharacterCatalogException();
        Receipts.Add(Clone(receipt));
        return Task.FromResult(Clone(receipt));
    }

    public Task<T> WithDefinitionLockAsync<T>(int campaignId, Guid catalogEntryId, Func<Task<T>> action, CancellationToken cancellationToken) =>
        InTransaction(async () => { LockOrder.Add($"definition:{catalogEntryId}"); if (await catalog.GetAsync(campaignId, catalogEntryId, cancellationToken) is null) throw new DomainException(404, "not_found", "The requested resource was not found.", catalogEntryId); return await action(); });

    public Task<T> WithCharacterLockAsync<T>(int campaignId, Guid catalogEntryId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken) =>
        InTransaction(async () =>
        {
            LockOrder.Add($"definition:{catalogEntryId}");
            if (await catalog.GetAsync(campaignId, catalogEntryId, cancellationToken) is null) throw new DomainException(404, "not_found", "The requested resource was not found.", catalogEntryId);
            LockOrder.Add($"character:{characterId}");
            if (!hasCharacter(campaignId, characterId)) throw new DomainException(404, "not_found", "The requested resource was not found.", characterId);
            return await action();
        });

    public Task<T> WithNewDefinitionCharacterLockAsync<T>(int campaignId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken) =>
        InTransaction(async () => { LockOrder.Add($"character:{characterId}"); if (!hasCharacter(campaignId, characterId)) throw new DomainException(404, "not_found", "The requested resource was not found.", characterId); return await action(); });

    public object CaptureState() => new State(Entries.Select(Clone).ToList(), Receipts.Select(Clone).ToList());

    public void RestoreState(object state)
    {
        var snapshot = (State)state;
        Entries.Clear();
        Entries.AddRange(snapshot.Entries.Select(Clone));
        Receipts.Clear();
        Receipts.AddRange(snapshot.Receipts.Select(Clone));
    }

    private async Task<T> InTransaction<T>(Func<Task<T>> callback)
    {
        TransactionCount++;
        var selfSnapshot = CaptureState();
        var otherSnapshots = otherParticipants.Select(x => (Participant: x, State: x.CaptureState())).ToArray();
        InsideTransaction = true;
        try
        {
            var result = await callback();
            return result;
        }
        catch
        {
            RestoreState(selfSnapshot);
            foreach (var (participant, state) in otherSnapshots) participant.RestoreState(state);
            throw;
        }
        finally { InsideTransaction = false; }
    }

    private void RequireTransaction() { if (!InsideTransaction) throw new InvalidOperationException(); }

    private static CharacterCatalogEntry<TCatalog> Clone(CharacterCatalogEntry<TCatalog> x) => new()
    {
        Id = x.Id, CampaignId = x.CampaignId, CharacterId = x.CharacterId, CatalogEntryId = x.CatalogEntryId,
        Quantity = x.Quantity, MetadataRevision = x.MetadataRevision
    };

    private static CatalogAdditionReceipt<TCatalog> Clone(CatalogAdditionReceipt<TCatalog> x) => new()
    {
        CampaignId = x.CampaignId, CharacterId = x.CharacterId, RequestId = x.RequestId, EntryId = x.EntryId, CatalogEntryId = x.CatalogEntryId
    };

    private sealed record State(List<CharacterCatalogEntry<TCatalog>> Entries, List<CatalogAdditionReceipt<TCatalog>> Receipts);
}
