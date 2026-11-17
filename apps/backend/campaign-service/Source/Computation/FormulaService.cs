using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Computation;

public sealed class FormulaService(IResourceStore resources, IContentStore content, SheetService sheets)
{
    private const string Collection = "formulaContents";

    public async Task<IReadOnlyList<FormulaMetadataDto>> ListAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        return (await resources.ListFormulasAsync(campaignId, cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task<FormulaMetadataDto> GetAsync(Subject? subject, int campaignId, Guid formulaId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        return ToDto(await RequireFormula(campaignId, formulaId, cancellationToken));
    }

    public async Task<FormulaContentEnvelope> GetContentAsync(Subject? subject, int campaignId, Guid formulaId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        await RequireFormula(campaignId, formulaId, cancellationToken);
        return await ReadContent(campaignId, formulaId, cancellationToken);
    }

    public async Task<FormulaCreateDto> CreateAsync(Subject? subject, int campaignId, FormulaCreateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        ValidateName(request.Name);
        var id = request.RequestId is { } requestId && requestId != Guid.Empty ? requestId : throw BadRequest("invalid_request", "A non-empty requestId is required.");
        var data = Validate(request.Expression, request.Parameters);
        if (await resources.GetFormulaAsync(campaignId, id, cancellationToken) is not null)
            throw new DomainException(409, "already_published", "The resource has already been published.", id, id);
        ContentEnvelope<FormulaContent> prepared;
        try
        {
            prepared = await content.CreateAsync(Collection, campaignId, id, data, cancellationToken);
        }
        catch (ContentAlreadyPreparedException)
        {
            throw new DomainException(409, "content_already_prepared", "Content for this resource is already prepared.", id, id);
        }
        try
        {
            var metadata = await resources.CreateFormulaAsync(new FormulaMetadata { Id = id, CampaignId = campaignId, Name = request.Name! }, cancellationToken);
            var dto = ToDto(metadata);
            return new FormulaCreateDto(dto.Id, dto.Key, dto.CampaignId, dto.Name, dto.MetadataRevision, prepared.ContentRevision);
        }
        catch (DuplicateResourceException)
        {
            throw new DomainException(409, "already_published", "The resource has already been published.", id, id);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception exception) when (exception is DbException or DbUpdateException or ResourceStoreException or CampaignStoreException)
        {
            throw new DomainException(503, "publication_outcome_unknown", "The metadata publication outcome could not be confirmed.", id, id);
        }
    }

    public async Task<FormulaMetadataDto> RenameAsync(Subject? subject, int campaignId, Guid formulaId, FormulaMetadataUpdateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        ValidateName(request.Name);
        var expected = RequireRevision(request.ExpectedRevision);
        var current = await RequireFormula(campaignId, formulaId, cancellationToken);
        if (!await resources.RenameFormulaAsync(campaignId, formulaId, request.Name!, expected, cancellationToken))
        {
            if (await resources.GetFormulaAsync(campaignId, formulaId, cancellationToken) is null) throw NotFound();
            throw RevisionConflict(formulaId);
        }
        return new FormulaMetadataDto(current.Id, current.Id.ToString("N"), current.CampaignId, request.Name!, expected + 1);
    }

    public async Task<FormulaContentEnvelope> UpdateContentAsync(Subject? subject, int campaignId, Guid formulaId, FormulaContentUpdateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        var expected = RequireRevision(request.ExpectedRevision);
        await RequireFormula(campaignId, formulaId, cancellationToken);
        var data = Validate(request.Expression, request.Parameters);
        var current = await ReadContent(campaignId, formulaId, cancellationToken);
        if (current.ContentRevision != expected) throw RevisionConflict(formulaId, "content_revision_conflict");
        var result = await content.ReplaceAsync(Collection, campaignId, formulaId, expected, data, cancellationToken);
        return result is null ? throw RevisionConflict(formulaId, "content_revision_conflict") : ToEnvelope(result);
    }

    public static FormulaContent Validate(string? expression, string[]? parameters)
    {
        if (string.IsNullOrWhiteSpace(expression) || parameters is null || parameters.Any(string.IsNullOrWhiteSpace) || parameters.Distinct(StringComparer.Ordinal).Count() != parameters.Length)
            throw BadRequest("invalid_formula", "Expression and unique non-empty parameter names are required.");
        try
        {
            var prepared = ExpressionAdapter.Prepare(expression);
            var declared = parameters.ToHashSet(StringComparer.Ordinal);
            if (prepared.ParameterNames.Any(name => !declared.Contains(name)))
                throw BadRequest("invalid_formula", "Every expression parameter must be declared.");
        }
        catch (DomainException) { throw; }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { throw BadRequest("invalid_formula", "The formula expression is invalid."); }
        return new FormulaContent(expression, parameters.ToArray());
    }

    private async Task<FormulaMetadata> RequireFormula(int campaignId, Guid id, CancellationToken cancellationToken) =>
        await resources.GetFormulaAsync(campaignId, id, cancellationToken) ?? throw NotFound();

    private async Task<FormulaContentEnvelope> ReadContent(int campaignId, Guid id, CancellationToken cancellationToken)
    {
        var contentEnvelope = await content.GetAsync<FormulaContent>(Collection, campaignId, id, cancellationToken);
        return contentEnvelope is null ? throw new DomainException(503, "content_unavailable", "The content store does not contain the published resource.", id) : ToEnvelope(contentEnvelope);
    }

    private static FormulaMetadataDto ToDto(FormulaMetadata metadata) => new(metadata.Id, metadata.Id.ToString("N"), metadata.CampaignId, metadata.Name, metadata.MetadataRevision);
    private static FormulaContentEnvelope ToEnvelope(ContentEnvelope<FormulaContent> envelope) => new(envelope.CampaignId, envelope.ResourceId, envelope.ContentRevision, envelope.Data);
    private static void ValidateName(string? name) { if (string.IsNullOrWhiteSpace(name)) throw BadRequest("invalid_name", "A non-whitespace name is required."); }
    private static long RequireRevision(long? revision) => revision is > 0 ? revision.Value : throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException NotFound() => new(404, "not_found", "The requested resource was not found.");
    private static DomainException RevisionConflict(Guid id, string code = "revision_conflict") => new(409, code, "The resource revision no longer matches.", id);
}
