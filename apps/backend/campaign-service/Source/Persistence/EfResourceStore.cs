using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Persistence;

public sealed class EfResourceStore(CampaignDbContext db) : IResourceStore
{
    public async Task<IReadOnlyList<TemplateMetadata>> ListTemplatesAsync(int campaignId, CancellationToken cancellationToken) =>
        await db.TemplateMetadata.AsNoTracking().Where(x => x.CampaignId == campaignId).OrderBy(x => x.Name).ToArrayAsync(cancellationToken);

    public Task<TemplateMetadata?> GetTemplateAsync(int campaignId, Guid templateId, CancellationToken cancellationToken) =>
        db.TemplateMetadata.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.Id == templateId, cancellationToken);

    public async Task<TemplateMetadata> CreateTemplateAsync(TemplateMetadata template, CancellationToken cancellationToken)
    {
        db.TemplateMetadata.Add(template);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return template;
        }
        catch (DbUpdateException exception) when (IsMySqlDuplicate(exception))
        {
            db.ChangeTracker.Clear();
            throw new DuplicateResourceException();
        }
    }

    public async Task<bool> RenameTemplateAsync(int campaignId, Guid templateId, string name, long expectedRevision, CancellationToken cancellationToken) =>
        await db.TemplateMetadata.Where(x => x.CampaignId == campaignId && x.Id == templateId && x.MetadataRevision == expectedRevision)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Name, name).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), cancellationToken) == 1;

    public async Task<IReadOnlyList<CharacterMetadata>> ListCharactersAsync(int campaignId, CancellationToken cancellationToken) =>
        await db.CharacterMetadata.AsNoTracking().Where(x => x.CampaignId == campaignId).OrderBy(x => x.Name).ToArrayAsync(cancellationToken);

    public Task<CharacterMetadata?> GetCharacterAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        db.CharacterMetadata.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.Id == characterId, cancellationToken);

    public async Task<IReadOnlyList<CharacterMetadata>> ListCharactersForUserAsync(int campaignId, int userId, CancellationToken cancellationToken) =>
        await (from character in db.CharacterMetadata.AsNoTracking()
               join assignment in db.CharacterAssignments.AsNoTracking() on new { character.CampaignId, CharacterId = character.Id } equals new { assignment.CampaignId, assignment.CharacterId }
               where character.CampaignId == campaignId && assignment.UserId == userId
               orderby character.Name
               select character).ToArrayAsync(cancellationToken);

    public async Task<CharacterMetadata> CreateCharacterAsync(CharacterMetadata character, CancellationToken cancellationToken)
    {
        db.CharacterMetadata.Add(character);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return character;
        }
        catch (DbUpdateException exception) when (IsMySqlDuplicate(exception))
        {
            db.ChangeTracker.Clear();
            throw new DuplicateResourceException();
        }
    }

    public async Task<bool> UpdateCharacterAsync(int campaignId, Guid characterId, string name, Importance importance, long expectedRevision, CancellationToken cancellationToken) =>
        await db.CharacterMetadata.Where(x => x.CampaignId == campaignId && x.Id == characterId && x.MetadataRevision == expectedRevision)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Name, name).SetProperty(x => x.Importance, importance).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), cancellationToken) == 1;

    public async Task<IReadOnlyList<CharacterAssignment>> ListAssignmentsAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        await db.CharacterAssignments.AsNoTracking().Where(x => x.CampaignId == campaignId && x.CharacterId == characterId).OrderBy(x => x.UserId).ToArrayAsync(cancellationToken);

    public Task<CharacterAssignment?> GetAssignmentAsync(int campaignId, Guid characterId, int userId, CancellationToken cancellationToken) =>
        db.CharacterAssignments.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.UserId == userId, cancellationToken);

    public Task<bool> IsCampaignMemberAsync(int campaignId, int userId, CancellationToken cancellationToken) =>
        db.CampaignMembers.AsNoTracking().AnyAsync(x => x.CampaignId == campaignId && x.UserId == userId, cancellationToken);

    public async Task<MemberUpdateResult> UpsertAssignmentAsync(int campaignId, Guid characterId, int userId, bool canWrite, long expectedRevision, CancellationToken cancellationToken)
    {
        if (expectedRevision == 0)
        {
            db.CharacterAssignments.Add(new CharacterAssignment { CampaignId = campaignId, CharacterId = characterId, UserId = userId, CanWrite = canWrite, MetadataRevision = 1 });
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return new MemberUpdateResult(1, true);
            }
            catch (DbUpdateException exception) when (IsMySqlDuplicate(exception))
            {
                db.ChangeTracker.Clear();
                return new MemberUpdateResult(null, true);
            }
        }

        var affected = await db.CharacterAssignments.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.UserId == userId && x.MetadataRevision == expectedRevision)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.CanWrite, canWrite).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), cancellationToken);
        if (affected == 1)
            return new MemberUpdateResult(expectedRevision + 1, true);
        var exists = await db.CharacterAssignments.AnyAsync(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.UserId == userId, cancellationToken);
        return new MemberUpdateResult(null, exists);
    }

    public async Task<bool> DeleteAssignmentAsync(int campaignId, Guid characterId, int userId, long expectedRevision, CancellationToken cancellationToken) =>
        await db.CharacterAssignments.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.UserId == userId && x.MetadataRevision == expectedRevision)
            .ExecuteDeleteAsync(cancellationToken) == 1;

    private static bool IsMySqlDuplicate(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is MySqlException mysql && mysql.Number == 1062)
                return true;
        }
        return false;
    }
}
