using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Views;

public sealed class ViewService(IResourceStore resources, IContentStore content, SheetService sheets, ComputedSheetService computed)
{
    private const string ViewCollection = "viewContents";

    public async Task<IReadOnlyList<ViewMetadataDto>> ListAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        return (await resources.ListViewsAsync(campaignId, cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task<ViewCreateDto> CreateAsync(Subject? subject, int campaignId, ViewCreateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        RequireName(request.Name);
        if (request.RequestId is null || request.RequestId == Guid.Empty)
            throw BadRequest("invalid_request_id", "A non-empty requestId is required.");
        var id = request.RequestId.Value;
        if (request.Roots is null)
            throw BadRequest("invalid_view", "roots is required.");
        if (await resources.GetViewAsync(campaignId, id, cancellationToken) is not null)
            throw AlreadyPublished(id);
        await ValidateTreeAsync(campaignId, request.Roots, cancellationToken);

        ContentEnvelope<ViewContent> prepared;
        try
        {
            prepared = await content.CreateAsync(ViewCollection, campaignId, id, new ViewContent(request.Roots), cancellationToken);
        }
        catch (ContentAlreadyPreparedException)
        {
            throw new DomainException(409, "content_already_prepared", "Content for this resource is already prepared.", id, id);
        }

        try
        {
            var metadata = await resources.CreateViewAsync(new ViewMetadata { Id = id, CampaignId = campaignId, Name = request.Name! }, cancellationToken);
            return new ViewCreateDto(metadata.Id, metadata.Id.ToString("N"), campaignId, metadata.Name, metadata.MetadataRevision, prepared.ContentRevision);
        }
        catch (DuplicateResourceException)
        {
            throw AlreadyPublished(id);
        }
        catch (Exception exception) when (IsSqlWriteFailure(exception))
        {
            throw PublicationOutcomeUnknown(id);
        }
    }

    public async Task<ViewMetadataDto> GetAsync(Subject? subject, int campaignId, Guid viewId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        return ToDto(await RequireViewAsync(campaignId, viewId, cancellationToken));
    }

    public async Task<ViewMetadataDto> RenameAsync(Subject? subject, int campaignId, Guid viewId, ViewMetadataUpdateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        RequireName(request.Name);
        var expected = RequireRevision(request.ExpectedRevision);
        var metadata = await RequireViewAsync(campaignId, viewId, cancellationToken);
        if (!await resources.RenameViewAsync(campaignId, viewId, request.Name!, expected, cancellationToken))
        {
            if (await resources.GetViewAsync(campaignId, viewId, cancellationToken) is null)
                throw NotFound();
            throw RevisionConflict(viewId);
        }
        return new ViewMetadataDto(metadata.Id, metadata.Id.ToString("N"), campaignId, request.Name!, expected + 1);
    }

    public async Task<ViewContentEnvelope> GetContentAsync(Subject? subject, int campaignId, Guid viewId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        await RequireViewAsync(campaignId, viewId, cancellationToken);
        return ToEnvelope(await ReadContentAsync(campaignId, viewId, cancellationToken));
    }

    public async Task<ViewContentEnvelope> UpdateContentAsync(Subject? subject, int campaignId, Guid viewId, ViewContentUpdateRequest request, CancellationToken cancellationToken)
    {
        await sheets.EnsureAdminAsync(subject, campaignId, cancellationToken);
        var expected = RequireRevision(request.ExpectedRevision);
        if (request.Roots is null)
            throw BadRequest("invalid_view", "roots is required.");
        await RequireViewAsync(campaignId, viewId, cancellationToken);
        var current = await ReadContentAsync(campaignId, viewId, cancellationToken);
        if (current.ContentRevision != expected)
            throw ContentRevisionConflict(viewId);
        await ValidateTreeAsync(campaignId, request.Roots, cancellationToken);
        var updated = await content.ReplaceAsync(ViewCollection, campaignId, viewId, expected, new ViewContent(request.Roots), cancellationToken);
        if (updated is null)
            throw ContentRevisionConflict(viewId);
        return ToEnvelope(updated);
    }

    public async Task<ViewSourcesResponse> GetSourcesAsync(Subject? subject, int campaignId, Guid viewId, Guid characterId, CancellationToken cancellationToken)
    {
        await sheets.EnsureDefinitionsReadAsync(subject, campaignId, cancellationToken);
        if (characterId == Guid.Empty)
            throw BadRequest("invalid_character_id", "characterId must be a non-empty GUID.");
        await RequireViewAsync(campaignId, viewId, cancellationToken);
        var view = await ReadContentAsync(campaignId, viewId, cancellationToken);
        var computedSheet = await computed.GetAsync(subject, campaignId, characterId, cancellationToken);
        var template = (await sheets.GetTemplateDocumentAsync(campaignId, cancellationToken)).Data;
        var baseFieldIds = template.BaseFields.Select(x => x.Id).ToHashSet();
        var templateVirtualFieldIds = template.VirtualFields.Select(x => x.Id).ToHashSet();
        var widgets = new List<WidgetSourcesProjection>();
        foreach (var widget in EnumerateWidgets(view.Data.Roots))
        {
            var sources = new ResolvedWidgetSource[widget.Sources.Length];
            for (var index = 0; index < widget.Sources.Length; index++)
            {
                var source = widget.Sources[index];
                if (!(source.Kind == FieldSourceKind.Base && baseFieldIds.Contains(source.FieldId) ||
                    source.Kind == FieldSourceKind.Virtual && templateVirtualFieldIds.Contains(source.FieldId)))
                {
                    sources[index] = new ResolvedWidgetSource(index, source, null, new ViewSourceDiagnostic("unknown_reference"));
                    continue;
                }
                if (source.Kind == FieldSourceKind.Base)
                {
                    var field = computedSheet.BaseFields.FirstOrDefault(x => x.Id == source.FieldId);
                    sources[index] = field is null
                        ? new ResolvedWidgetSource(index, source, null, new ViewSourceDiagnostic("unknown_reference"))
                        : new ResolvedWidgetSource(index, source, field.EffectiveValue.Clone(), null);
                }
                else
                {
                    var field = computedSheet.VirtualFields.FirstOrDefault(x => x.Id == source.FieldId);
                    if (field is null)
                    {
                        sources[index] = new ResolvedWidgetSource(index, source, null, new ViewSourceDiagnostic("unknown_reference"));
                    }
                    else if (field.Diagnostic is not null)
                    {
                        sources[index] = new ResolvedWidgetSource(index, source, null, new ViewSourceDiagnostic(field.Diagnostic.Code));
                    }
                    else
                    {
                        sources[index] = new ResolvedWidgetSource(index, source, JsonSerializer.SerializeToElement(field.Value), null);
                    }
                }
            }
            widgets.Add(new WidgetSourcesProjection(widget.NodeKey, sources));
        }

        return new ViewSourcesResponse(view.ContentRevision, computedSheet.ContentRevision, computedSheet.TemplateContentRevision,
            computedSheet.FormulaContentRevisions, widgets);
    }

    public async Task<ViewMetadata> RequireMetadataAsync(int campaignId, Guid viewId, CancellationToken cancellationToken) =>
        await RequireViewAsync(campaignId, viewId, cancellationToken);

    private async Task ValidateTreeAsync(int campaignId, ViewNode[] roots, CancellationToken cancellationToken)
    {
        var nodeKeys = new HashSet<string>(StringComparer.Ordinal);
        TemplateContent? template = null;
        var pending = new Stack<ViewNode>();
        for (var index = roots.Length - 1; index >= 0; index--)
        {
            if (roots[index] is null) throw InvalidTree("View nodes cannot be null.");
            pending.Push(roots[index]);
        }

        while (pending.Count > 0)
        {
            var node = pending.Pop();
            if (node is not (LayoutNode or WidgetNode) || node.Children is null || node.Title is null ||
                string.IsNullOrWhiteSpace(node.NodeKey) || !nodeKeys.Add(node.NodeKey) || node.Params.ValueKind == JsonValueKind.Undefined)
                throw InvalidTree("Each node requires a unique non-whitespace nodeKey, title, params, and children.");

            if (node is WidgetNode widget)
            {
                if (widget.Sources is null || widget.Format is null)
                    throw InvalidTree("Widget sources and format are required.");
                foreach (var source in widget.Sources)
                {
                    if (source is null || !Enum.IsDefined(source.Kind) || source.FieldId == Guid.Empty)
                        throw InvalidSource();
                    template ??= (await sheets.GetTemplateDocumentAsync(campaignId, cancellationToken)).Data;
                    if (source.Kind == FieldSourceKind.Base && template.BaseFields.All(x => x.Id != source.FieldId) ||
                        source.Kind == FieldSourceKind.Virtual && template.VirtualFields.All(x => x.Id != source.FieldId))
                        throw InvalidSource();
                }
            }

            for (var index = node.Children.Length - 1; index >= 0; index--)
            {
                if (node.Children[index] is null) throw InvalidTree("View children cannot be null.");
                pending.Push(node.Children[index]);
            }
        }
    }

    private static IEnumerable<WidgetNode> EnumerateWidgets(ViewNode[] roots)
    {
        var pending = new Stack<ViewNode>();
        for (var index = roots.Length - 1; index >= 0; index--) pending.Push(roots[index]);
        while (pending.Count > 0)
        {
            var node = pending.Pop();
            if (node is WidgetNode widget) yield return widget;
            for (var index = node.Children.Length - 1; index >= 0; index--) pending.Push(node.Children[index]);
        }
    }

    private async Task<ViewMetadata> RequireViewAsync(int campaignId, Guid viewId, CancellationToken cancellationToken) =>
        await resources.GetViewAsync(campaignId, viewId, cancellationToken) ?? throw NotFound();

    private async Task<ContentEnvelope<ViewContent>> ReadContentAsync(int campaignId, Guid viewId, CancellationToken cancellationToken) =>
        await content.GetAsync<ViewContent>(ViewCollection, campaignId, viewId, cancellationToken) ?? throw ContentMissing(viewId);

    internal static ViewMetadataDto ToDto(ViewMetadata metadata) =>
        new(metadata.Id, metadata.Id.ToString("N"), metadata.CampaignId, metadata.Name, metadata.MetadataRevision);

    private static ViewContentEnvelope ToEnvelope(ContentEnvelope<ViewContent> envelope) =>
        new(envelope.CampaignId, envelope.ResourceId, envelope.ContentRevision, envelope.Data);

    private static void RequireName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) throw BadRequest("invalid_name", "A non-whitespace name is required.");
    }

    private static long RequireRevision(long? revision) => revision is > 0 ? revision.Value : throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
    private static bool IsSqlWriteFailure(Exception exception) => exception is DbUpdateException or DbException or ResourceStoreException or CampaignStoreException;
    private static DomainException InvalidTree(string message) => BadRequest("invalid_view", message);
    private static DomainException InvalidSource() => BadRequest("invalid_source", "A source must identify an active field in the campaign template.");
    private static DomainException AlreadyPublished(Guid id) => new(409, "already_published", "The resource has already been published.", id, id);
    private static DomainException PublicationOutcomeUnknown(Guid id) => new(503, "publication_outcome_unknown", "The metadata publication outcome could not be confirmed.", id, id);
    private static DomainException ContentRevisionConflict(Guid id) => new(409, "content_revision_conflict", "The content revision no longer matches.", id);
    private static DomainException RevisionConflict(Guid id) => new(409, "revision_conflict", "The resource revision no longer matches.", id);
    private static DomainException ContentMissing(Guid id) => new(503, "content_unavailable", "The content store does not contain the published resource.", id);
    private static DomainException NotFound() => new(404, "not_found", "The requested resource was not found.");
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
}
