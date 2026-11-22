using System.Text.Json;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

internal sealed class CharacterCatalogTestFixture
{
    private static readonly Subject Admin = new(SubjectType.Admin, 9);

    private CharacterCatalogTestFixture(SheetServiceTests.Fixture sheets)
    {
        Sheets = sheets;
        CatalogStore = new FakeCatalogStore();
        Store = new FakeCharacterCatalogStore(CatalogStore, (campaignId, characterId) =>
            Sheets.Resources.Characters.Any(x => x.CampaignId == campaignId && x.Id == characterId), CatalogStore);
        Catalog = new CatalogService(new Tdn.Campaigns.Campaigns.CampaignService(Sheets.Campaigns), CatalogStore, Sheets.Content, Store);
        Service = new CharacterCatalogService(Sheets.Sheets, Catalog, CatalogStore, Store, Sheets.Content);
    }

    public SheetServiceTests.Fixture Sheets { get; }
    public FakeCatalogStore CatalogStore { get; }
    public FakeCharacterCatalogStore Store { get; }
    public CatalogService Catalog { get; }
    public CharacterCatalogService Service { get; }

    public static CharacterCatalogTestFixture Create() => new(SheetServiceTests.CreateFixture());

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

    public Task<CatalogCreateResult> CreateDefinitionAsync(CatalogKind kind, bool hidden = false, QuantityUnit? unit = QuantityUnit.Whole, bool allowNegative = false,
        CatalogAttributeValue[]? attributes = null, Subject? subject = null, string name = "Test definition", Guid? requestId = null) =>
        Catalog.CreateAsync(subject ?? Admin, 7, new CatalogCreateRequest
        {
            RequestId = requestId ?? Guid.NewGuid(), Name = name, Kind = kind, IsHidden = hidden, QuantityUnit = unit,
            AllowNegative = allowNegative, Description = "Definition description", Attributes = attributes ?? []
        }, default);

    internal static JsonElement Json(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    internal static CatalogAttributeDefinitionInput Definition(string title, string typeKey, ChoiceOption[]? options = null) => new()
    {
        Title = title, TypeKey = typeKey, Options = options ?? [], IsActive = true
    };

    internal static CatalogAttributeValue Value(Guid id, Guid attributeId, string typeKey, long revision, string json, AttributeEditLevel level = AttributeEditLevel.Character) =>
        new(id, attributeId, typeKey, revision, Json(json), level);
}

internal interface IFakeTransactionParticipant
{
    object CaptureState();
    void RestoreState(object state);
}

internal sealed class FakeCatalogStore : ICatalogStore, IFakeTransactionParticipant
{
    public List<CatalogEntry> Entries { get; } = [];
    public int CreateCount { get; private set; }
    public int UpdateCount { get; private set; }
    public Exception? CreateFailure { get; set; }
    public Action<CatalogEntry>? BeforeCreate { get; set; }
    public Action<int, Guid>? BeforeUpdate { get; set; }

    public Task<IReadOnlyList<CatalogEntry>> ListAsync(int campaignId, CatalogKind? kind, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CatalogEntry>>(Entries.Where(x => x.CampaignId == campaignId && (kind is null || x.Kind == kind)).OrderBy(x => x.Name).Select(Clone).ToArray());

    public Task<CatalogEntry?> GetAsync(int campaignId, Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Entries.Where(x => x.CampaignId == campaignId && x.Id == id).Select(Clone).SingleOrDefault());

    public Task<CatalogEntry> CreateAsync(CatalogEntry entry, CancellationToken cancellationToken)
    {
        CreateCount++;
        BeforeCreate?.Invoke(entry);
        if (CreateFailure is not null) throw CreateFailure;
        if (Entries.Any(x => x.Id == entry.Id)) throw new DuplicateResourceException();
        Entries.Add(Clone(entry));
        return Task.FromResult(Clone(entry));
    }

    public Task<bool> UpdateAsync(int campaignId, Guid id, string name, bool isHidden, QuantityUnit? quantityUnit, bool allowNegative, long expectedRevision, CancellationToken cancellationToken)
    {
        UpdateCount++;
        BeforeUpdate?.Invoke(campaignId, id);
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
        Entries.AddRange(((List<CatalogEntry>)state).Select(Clone));
    }

    private static CatalogEntry Clone(CatalogEntry x) => new()
    {
        Id = x.Id, CampaignId = x.CampaignId, Name = x.Name, Kind = x.Kind, CreatorUserId = x.CreatorUserId,
        IsHidden = x.IsHidden, QuantityUnit = x.QuantityUnit, AllowNegative = x.AllowNegative, MetadataRevision = x.MetadataRevision
    };
}

internal sealed class FakeCharacterCatalogStore : ICharacterCatalogStore, IFakeTransactionParticipant
{
    private readonly ICatalogStore catalog;
    private readonly Func<int, Guid, bool> hasCharacter;
    private readonly IFakeTransactionParticipant[] otherParticipants;

    public FakeCharacterCatalogStore(ICatalogStore catalog, Func<int, Guid, bool> hasCharacter, params IFakeTransactionParticipant[] otherParticipants)
    {
        this.catalog = catalog;
        this.hasCharacter = hasCharacter;
        this.otherParticipants = otherParticipants;
    }

    public List<CharacterCatalogEntry> Entries { get; } = [];
    public List<CatalogAdditionReceipt> Receipts { get; } = [];
    public List<string> LockOrder { get; } = [];
    public int TransactionCount { get; private set; }
    public int WriteAttempts { get; private set; }
    public bool InsideTransaction { get; private set; }
    public Exception? BeforeCommitFailure { get; set; }
    public Exception? AfterCommitFailure { get; set; }
    public Action<CharacterCatalogEntry>? BeforeRecordCreate { get; set; }

    public Task<IReadOnlyList<CharacterCatalogEntry>> ListAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CharacterCatalogEntry>>(Entries.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId).OrderBy(x => x.Id).Select(Clone).ToArray());

    public Task<IReadOnlyList<CharacterCatalogEntry>> ListByCatalogEntryAsync(int campaignId, Guid catalogEntryId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CharacterCatalogEntry>>(Entries.Where(x => x.CampaignId == campaignId && x.CatalogEntryId == catalogEntryId).OrderBy(x => x.CharacterId).ThenBy(x => x.Id).Select(Clone).ToArray());

    public Task<CharacterCatalogEntry?> GetAsync(int campaignId, Guid characterId, Guid entryId, CancellationToken cancellationToken) =>
        Task.FromResult(Entries.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId).Select(Clone).SingleOrDefault());

    public Task<CharacterCatalogEntry> CreateAsync(CharacterCatalogEntry entry, CancellationToken cancellationToken)
    {
        RequireTransaction();
        WriteAttempts++;
        BeforeRecordCreate?.Invoke(entry);
        if (Entries.Any(x => x.Id == entry.Id)) throw new DuplicateCharacterCatalogException();
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

    public Task<CatalogAdditionReceipt?> GetAdditionAsync(int campaignId, Guid characterId, Guid requestId, CancellationToken cancellationToken) =>
        Task.FromResult(Receipts.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.RequestId == requestId).Select(Clone).SingleOrDefault());

    public Task<CatalogAdditionReceipt> CreateAdditionAsync(CatalogAdditionReceipt receipt, CancellationToken cancellationToken)
    {
        RequireTransaction();
        WriteAttempts++;
        if (Receipts.Any(x => x.CampaignId == receipt.CampaignId && x.CharacterId == receipt.CharacterId && x.RequestId == receipt.RequestId))
            throw new DuplicateCharacterCatalogException();
        Receipts.Add(Clone(receipt));
        return Task.FromResult(Clone(receipt));
    }

    public Task<T> WithDefinitionLockAsync<T>(int campaignId, Guid catalogEntryId, Func<Task<T>> action, CancellationToken cancellationToken)
    {
        return InTransaction(async () =>
        {
            LockOrder.Add($"definition:{catalogEntryId}");
            if (await catalog.GetAsync(campaignId, catalogEntryId, cancellationToken) is null) throw new DomainException(404, "not_found", "The requested resource was not found.", catalogEntryId);
            return await action();
        });
    }

    public Task<T> WithCharacterLockAsync<T>(int campaignId, Guid catalogEntryId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken)
    {
        return InTransaction(async () =>
        {
            LockOrder.Add($"definition:{catalogEntryId}");
            if (await catalog.GetAsync(campaignId, catalogEntryId, cancellationToken) is null) throw new DomainException(404, "not_found", "The requested resource was not found.", catalogEntryId);
            LockOrder.Add($"character:{characterId}");
            if (!hasCharacter(campaignId, characterId)) throw new DomainException(404, "not_found", "The requested resource was not found.", characterId);
            return await action();
        });
    }

    public Task<T> WithNewDefinitionCharacterLockAsync<T>(int campaignId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken)
    {
        return InTransaction(async () =>
        {
            LockOrder.Add($"character:{characterId}");
            if (!hasCharacter(campaignId, characterId)) throw new DomainException(404, "not_found", "The requested resource was not found.", characterId);
            return await action();
        });
    }

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
        var committed = false;
        try
        {
            var result = await callback();
            if (BeforeCommitFailure is { } before)
            {
                BeforeCommitFailure = null;
                throw before;
            }
            committed = true;
            if (AfterCommitFailure is { } after)
            {
                AfterCommitFailure = null;
                throw after;
            }
            return result;
        }
        catch
        {
            if (!committed)
            {
                RestoreState(selfSnapshot);
                foreach (var (participant, state) in otherSnapshots) participant.RestoreState(state);
            }
            throw;
        }
        finally
        {
            InsideTransaction = false;
        }
    }

    private void RequireTransaction()
    {
        if (!InsideTransaction) throw new InvalidOperationException();
    }

    private static CharacterCatalogEntry Clone(CharacterCatalogEntry x) => new()
    {
        Id = x.Id, CampaignId = x.CampaignId, CharacterId = x.CharacterId, CatalogEntryId = x.CatalogEntryId,
        Quantity = x.Quantity, MetadataRevision = x.MetadataRevision
    };

    private static CatalogAdditionReceipt Clone(CatalogAdditionReceipt x) => new()
    {
        CampaignId = x.CampaignId, CharacterId = x.CharacterId, RequestId = x.RequestId,
        EntryId = x.EntryId, CatalogEntryId = x.CatalogEntryId
    };

    private sealed record State(List<CharacterCatalogEntry> Entries, List<CatalogAdditionReceipt> Receipts);
}
