using Tdn.Campaigns.Campaigns;

namespace Tdn.Campaigns.Sheets;

public interface IResourceStore
{
    Task<TemplateMetadata?> GetTemplateAsync(int campaignId, CancellationToken cancellationToken);
    Task<bool> RenameTemplateAsync(int campaignId, string name, long expectedRevision, CancellationToken cancellationToken);
    Task<IReadOnlyList<CharacterMetadata>> ListCharactersAsync(int campaignId, CancellationToken cancellationToken);
    Task<CharacterMetadata?> GetCharacterAsync(int campaignId, Guid characterId, CancellationToken cancellationToken);
    Task<IReadOnlyList<CharacterMetadata>> ListCharactersForUserAsync(int campaignId, int userId, CancellationToken cancellationToken);
    Task<CharacterMetadata> CreateCharacterAsync(CharacterMetadata character, CancellationToken cancellationToken);
    Task<bool> UpdateCharacterAsync(int campaignId, Guid characterId, string name, Importance importance, long expectedRevision, CancellationToken cancellationToken);
    Task<IReadOnlyList<CharacterAssignment>> ListAssignmentsAsync(int campaignId, Guid characterId, CancellationToken cancellationToken);
    Task<CharacterAssignment?> GetAssignmentAsync(int campaignId, Guid characterId, int userId, CancellationToken cancellationToken);
    Task<bool> IsCampaignMemberAsync(int campaignId, int userId, CancellationToken cancellationToken);
    Task<MemberUpdateResult> UpsertAssignmentAsync(int campaignId, Guid characterId, int userId, bool canWrite, long expectedRevision, CancellationToken cancellationToken);
    Task<bool> DeleteAssignmentAsync(int campaignId, Guid characterId, int userId, long expectedRevision, CancellationToken cancellationToken);
    Task<IReadOnlyList<FormulaMetadata>> ListFormulasAsync(int campaignId, CancellationToken cancellationToken);
    Task<FormulaMetadata?> GetFormulaAsync(int campaignId, Guid formulaId, CancellationToken cancellationToken);
    Task<FormulaMetadata> CreateFormulaAsync(FormulaMetadata formula, CancellationToken cancellationToken);
    Task<bool> RenameFormulaAsync(int campaignId, Guid formulaId, string name, long expectedRevision, CancellationToken cancellationToken);
    Task<IReadOnlyList<ViewMetadata>> ListViewsAsync(int campaignId, CancellationToken cancellationToken);
    Task<ViewMetadata?> GetViewAsync(int campaignId, Guid viewId, CancellationToken cancellationToken);
    Task<ViewMetadata> CreateViewAsync(ViewMetadata view, CancellationToken cancellationToken);
    Task<bool> RenameViewAsync(int campaignId, Guid viewId, string name, long expectedRevision, CancellationToken cancellationToken);
}

public sealed class DuplicateResourceException : Exception
{
}

public sealed class ResourceStoreException : Exception
{
}
