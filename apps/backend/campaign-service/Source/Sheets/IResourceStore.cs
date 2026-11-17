using Tdn.Campaigns.Campaigns;

namespace Tdn.Campaigns.Sheets;

public interface IResourceStore
{
    Task<IReadOnlyList<TemplateMetadata>> ListTemplatesAsync(int campaignId, CancellationToken cancellationToken);
    Task<TemplateMetadata?> GetTemplateAsync(int campaignId, Guid templateId, CancellationToken cancellationToken);
    Task<TemplateMetadata> CreateTemplateAsync(TemplateMetadata template, CancellationToken cancellationToken);
    Task<bool> RenameTemplateAsync(int campaignId, Guid templateId, string name, long expectedRevision, CancellationToken cancellationToken);
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
}

public sealed class DuplicateResourceException : Exception
{
}

public sealed class ResourceStoreException : Exception
{
}
