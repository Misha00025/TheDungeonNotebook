using System.Text.Json;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Views;

public sealed class PresentationService(IResourceStore resources, IContentStore content, SheetService sheets, ViewService views)
{
    private const string PresentationCollection = "campaignPresentationConfigs";
    private static readonly Guid PresentationResourceId = Guid.Empty;

    public async Task<PresentationEnvelope> GetAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        var stored = await content.GetAsync<PresentationConfig>(PresentationCollection, campaignId, PresentationResourceId, cancellationToken);
        return stored is null
            ? new PresentationEnvelope(0, new Dictionary<string, string>(), new Dictionary<string, JsonElement>())
            : ToEnvelope(stored);
    }

    public async Task<PresentationEnvelope> UpdateAsync(Subject? subject, int campaignId, PresentationUpdateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        if (request.ExpectedRevision is null || request.ExpectedRevision < 0 || request.Defaults is null || request.ContextParams is null)
            throw BadRequest("invalid_presentation", "expectedRevision, defaults, and contextParams are required; expectedRevision must be nonnegative.");

        var defaults = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entry in request.Defaults)
        {
            if (string.IsNullOrEmpty(entry.Key))
                throw BadRequest("invalid_context_key", "Context keys must be non-empty strings.");
            if (!TryParseViewKey(entry.Value, out var viewId))
                throw InvalidViewReference();
            if (await resources.GetViewAsync(campaignId, viewId, cancellationToken) is null)
                throw InvalidViewReference();
            defaults.Add(entry.Key, viewId.ToString("N"));
        }

        var contextParams = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var entry in request.ContextParams)
        {
            if (string.IsNullOrEmpty(entry.Key))
                throw BadRequest("invalid_context_key", "Context keys must be non-empty strings.");
            if (entry.Value.ValueKind == JsonValueKind.Undefined)
                throw BadRequest("invalid_context_params", "Context parameter values must be JSON values.");
            contextParams.Add(entry.Key, entry.Value.Clone());
        }

        var expected = request.ExpectedRevision.Value;
        var data = new PresentationConfig(defaults, contextParams);
        if (expected == 0)
        {
            try
            {
                return ToEnvelope(await content.CreateAsync(PresentationCollection, campaignId, PresentationResourceId, data, cancellationToken));
            }
            catch (ContentAlreadyPreparedException)
            {
                throw RevisionConflict();
            }
        }

        var current = await content.GetAsync<PresentationConfig>(PresentationCollection, campaignId, PresentationResourceId, cancellationToken);
        if (current is null || current.ContentRevision != expected)
            throw RevisionConflict();
        var updated = await content.ReplaceAsync(PresentationCollection, campaignId, PresentationResourceId, expected, data, cancellationToken);
        if (updated is null)
            throw RevisionConflict();
        return ToEnvelope(updated);
    }

    public async Task<ResolvedPresentationDto> ResolveAsync(Subject? subject, int campaignId, string contextKey, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        if (string.IsNullOrEmpty(contextKey))
            throw BadRequest("invalid_context_key", "contextKey must be a non-empty string.");
        var stored = await content.GetAsync<PresentationConfig>(PresentationCollection, campaignId, PresentationResourceId, cancellationToken);
        if (stored is null || !stored.Data.Defaults.TryGetValue(contextKey, out var key))
            throw new DomainException(404, "view_not_configured", "No view is configured for this context.");
        if (!TryParseViewKey(key, out var viewId))
            throw InvalidViewReference();

        var metadata = await views.RequireMetadataAsync(campaignId, viewId, cancellationToken);
        var viewContent = await views.GetContentAsync(subject, campaignId, viewId, cancellationToken);
        var parameters = stored.Data.ContextParams.TryGetValue(contextKey, out var value) ? value.Clone() : (JsonElement?)null;
        return new ResolvedPresentationDto(contextKey, ViewService.ToDto(metadata), viewContent, parameters, stored.ContentRevision);
    }

    private static PresentationEnvelope ToEnvelope(ContentEnvelope<PresentationConfig> envelope) =>
        new(envelope.ContentRevision, envelope.Data.Defaults, envelope.Data.ContextParams);

    private static bool TryParseViewKey(string? key, out Guid viewId)
    {
        viewId = Guid.Empty;
        return key is not null && (Guid.TryParseExact(key, "D", out viewId) || Guid.TryParseExact(key, "N", out viewId)) && viewId != Guid.Empty;
    }

    private static DomainException InvalidViewReference() =>
        BadRequest("invalid_view", "Each default must reference a published view in this campaign.");

    private static DomainException RevisionConflict() =>
        new(409, "content_revision_conflict", "The presentation configuration revision no longer matches.", PresentationResourceId);

    private static DomainException BadRequest(string code, string message) => new(400, code, message);
}
