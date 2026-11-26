using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.WorldContent;

public sealed class WorldMaterialService(CampaignService campaigns, IWorldMaterialStore store, IOptions<WorldContentOptions> options)
{
    private readonly string root = Path.GetFullPath(options.Value.RootPath);
    private static readonly HashSet<string> Kinds = new(StringComparer.Ordinal) { "locations", "organizations", "lore" };

    public async Task<IReadOnlyList<WorldMaterialDto>> ListAsync(Subject? subject, int campaignId, string kind, string? tag, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        RequireKind(kind);
        return (await store.ListAsync(campaignId, kind, tag, ct)).Where(x => access.IsAdmin || x.IsPublished).Select(ToDto).ToArray();
    }

    public async Task<WorldMaterialDto> GetAsync(Subject? subject, int campaignId, string kind, Guid id, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        RequireKind(kind);
        return ToDto(await RequireReadable(access, campaignId, kind, id, ct));
    }

    public async Task<WorldMaterialCreatedDto> CreateAsync(Subject? subject, int campaignId, string kind, WorldMaterialCreateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        RequireKind(kind);
        if (request.RequestId is not { } id || id == Guid.Empty) throw BadRequest("invalid_request_id", "A non-empty requestId is required.");
        Validate(request.Title, request.Description, request.Tags);
        if (request.Body is null) throw BadRequest("invalid_content", "body is required.");
        using var held = await LockAsync(campaignId, id, ct);
        if (await store.GetAsync(campaignId, kind, id, ct) is not null) throw NotFoundMaterial();
        var path = BodyPath(campaignId, id);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (File.Exists(path)) throw PreparedContent(id);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            var bytes = Encoding.UTF8.GetBytes(request.Body);
            await using (var file = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, true))
            {
                await file.WriteAsync(bytes, ct);
            }
            try { File.Move(temp, path, false); }
            catch (IOException) when (File.Exists(path)) { throw PreparedContent(id); }
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
        var entity = new WorldMaterial { Id = id, CampaignId = campaignId, Kind = kind, Title = request.Title!, Description = request.Description!, Tags = JsonSerializer.Serialize(request.Tags), IsPublished = false };
        try
        {
            var created = await store.CreateAsync(entity, ct);
            return new(ToDto(created), Hash(await File.ReadAllBytesAsync(path, ct)));
        }
        catch (WorldMaterialDuplicateException) { throw new DomainException(409, "already_published", "The resource has already been published.", id, id); }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (exception is DbException or DbUpdateException or CampaignStoreException)
        {
            throw new DomainException(503, "publication_outcome_unknown", "The metadata publication outcome could not be confirmed.", id, id);
        }
    }

    public async Task<WorldMaterialDto> UpdateAsync(Subject? subject, int campaignId, string kind, Guid id, WorldMaterialUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        RequireKind(kind);
        Validate(request.Title, request.Description, request.Tags);
        if (request.ExpectedRevision is not > 0) throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        var current = await store.GetAsync(campaignId, kind, id, ct) ?? throw NotFoundMaterial();
        if (current.MetadataRevision != request.ExpectedRevision) throw Conflict(id);
        if (!await store.UpdateAsync(campaignId, kind, id, request.Title!, request.Description!, JsonSerializer.Serialize(request.Tags), request.IsPublished!.Value, request.ExpectedRevision.Value, ct))
            throw Conflict(id);
        return new(id, campaignId, kind, request.Title!, request.Description!, request.Tags!, request.IsPublished.Value, request.ExpectedRevision.Value + 1);
    }

    public async Task<WorldMaterialBodyDto> GetBodyAsync(Subject? subject, int campaignId, string kind, Guid id, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        RequireKind(kind);
        await RequireReadable(access, campaignId, kind, id, ct);
        var bytes = await File.ReadAllBytesAsync(BodyPath(campaignId, id), ct);
        return new(Encoding.UTF8.GetString(bytes), Hash(bytes));
    }

    public async Task<WorldMaterialBodyDto> UpdateBodyAsync(Subject? subject, int campaignId, string kind, Guid id, WorldMaterialBodyUpdateRequest request, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        RequireKind(kind);
        if (request.Body is null || string.IsNullOrEmpty(request.ExpectedVersion)) throw BadRequest("invalid_content", "body and expectedVersion are required.");
        using var held = await LockAsync(campaignId, id, ct);
        access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        await RequireReadable(access, campaignId, kind, id, ct);
        var path = BodyPath(campaignId, id);
        var current = await File.ReadAllBytesAsync(path, ct);
        if (!string.Equals(Hash(current), request.ExpectedVersion, StringComparison.Ordinal)) throw Conflict(id);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await File.WriteAllBytesAsync(temp, Encoding.UTF8.GetBytes(request.Body), ct);
            File.Move(temp, path, true);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
        var updated = await File.ReadAllBytesAsync(path, ct);
        return new(Encoding.UTF8.GetString(updated), Hash(updated));
    }

    public async Task DeleteAsync(Subject? subject, int campaignId, string kind, Guid id, long expectedRevision, CancellationToken ct)
    {
        var access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        RequireKind(kind);
        if (expectedRevision < 1) throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        using var held = await LockAsync(campaignId, id, ct);
        access = await campaigns.GetAccessAsync(subject, campaignId, ct);
        EnsureAdmin(access);
        if (!await store.DeleteAsync(campaignId, kind, id, expectedRevision, ct))
        {
            if (await store.GetAsync(campaignId, kind, id, ct) is null) throw NotFoundMaterial();
            throw Conflict(id);
        }
        File.Delete(BodyPath(campaignId, id));
    }

    private async Task<WorldMaterial> RequireReadable(CampaignAccess access, int campaignId, string kind, Guid id, CancellationToken ct)
    {
        var material = await store.GetAsync(campaignId, kind, id, ct) ?? throw NotFoundMaterial();
        return access.IsAdmin || material.IsPublished ? material : throw NotFoundMaterial();
    }

    private async Task<FileStream> LockAsync(int campaignId, Guid id, CancellationToken ct)
    {
        var path = BodyPath(campaignId, id);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        while (true)
        {
            ct.ThrowIfCancellationRequested();
            try { return new FileStream(path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
            catch (IOException) { await Task.Delay(50, ct); }
        }
    }

    private string BodyPath(int campaignId, Guid id) => Path.Combine(root, campaignId.ToString(System.Globalization.CultureInfo.InvariantCulture), id.ToString("N") + ".md");
    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    private static WorldMaterialDto ToDto(WorldMaterial item) => new(item.Id, item.CampaignId, item.Kind, item.Title, item.Description, JsonSerializer.Deserialize<string[]>(item.Tags)!, item.IsPublished, item.MetadataRevision);
    private static void RequireKind(string kind) { if (!Kinds.Contains(kind)) throw NotFoundMaterial(); }
    private static void Validate(string? title, string? description, string[]? tags)
    {
        if (string.IsNullOrWhiteSpace(title)) throw BadRequest("invalid_title", "A non-whitespace title is required.");
        if (description is null || tags is null || tags.Any(string.IsNullOrEmpty)) throw BadRequest("invalid_content", "description and tags are required; tags must be non-empty strings.");
    }
    private static void EnsureAdmin(CampaignAccess access) { if (!access.IsAdmin) throw new DomainException(403, "forbidden", "The operation is not permitted."); }
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException Conflict(Guid id) => new(409, "revision_conflict", "The resource revision no longer matches.", id);
    private static DomainException PreparedContent(Guid id) => new(409, "content_already_prepared", "Content for this resource is already prepared.", id, id);
    private static DomainException NotFoundMaterial() => new(404, "not_found", "The requested resource was not found.");
}
