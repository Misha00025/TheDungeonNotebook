using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Persistence;

public sealed class CampaignDbContext(DbContextOptions<CampaignDbContext> options) : DbContext(options)
{
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CampaignMember> CampaignMembers => Set<CampaignMember>();
    public DbSet<TemplateMetadata> TemplateMetadata => Set<TemplateMetadata>();
    public DbSet<CharacterMetadata> CharacterMetadata => Set<CharacterMetadata>();
    public DbSet<CharacterAssignment> CharacterAssignments => Set<CharacterAssignment>();
    public DbSet<FormulaMetadata> FormulaMetadata => Set<FormulaMetadata>();
    public DbSet<ViewMetadata> ViewMetadata => Set<ViewMetadata>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var campaign = modelBuilder.Entity<Campaign>();
        campaign.ToTable("Campaigns", table => table.HasCheckConstraint("CK_Campaigns_MetadataRevision", "MetadataRevision >= 1"));
        campaign.HasKey(x => x.Id);
        campaign.Property(x => x.Id).ValueGeneratedOnAdd();
        campaign.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        campaign.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        campaign.Property(x => x.CreationRequestId).IsRequired();
        campaign.HasIndex(x => x.CreationRequestId).IsUnique();

        var member = modelBuilder.Entity<CampaignMember>();
        member.ToTable("CampaignMembers", table => table.HasCheckConstraint("CK_CampaignMembers_MetadataRevision", "MetadataRevision >= 1"));
        member.HasKey(x => new { x.CampaignId, x.UserId });
        member.Property(x => x.IsAdmin).IsRequired();
        member.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        member.HasIndex(x => x.UserId);
        member.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var template = modelBuilder.Entity<TemplateMetadata>();
        template.ToTable("TemplateMetadata", table => table.HasCheckConstraint("CK_TemplateMetadata_MetadataRevision", "MetadataRevision >= 1"));
        template.HasKey(x => x.Id);
        template.HasAlternateKey(x => new { x.CampaignId, x.Id });
        template.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        template.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        template.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var character = modelBuilder.Entity<CharacterMetadata>();
        character.ToTable("CharacterMetadata", table => table.HasCheckConstraint("CK_CharacterMetadata_MetadataRevision", "MetadataRevision >= 1"));
        character.HasKey(x => x.Id);
        character.HasAlternateKey(x => new { x.CampaignId, x.Id });
        character.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        character.Property(x => x.Importance).IsRequired();
        character.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        character.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);
        character.HasOne(x => x.Template).WithMany().HasForeignKey(x => new { x.CampaignId, x.TemplateId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict);

        var assignment = modelBuilder.Entity<CharacterAssignment>();
        assignment.ToTable("CharacterAssignments", table => table.HasCheckConstraint("CK_CharacterAssignments_MetadataRevision", "MetadataRevision >= 1"));
        assignment.HasKey(x => new { x.CampaignId, x.CharacterId, x.UserId });
        assignment.Property(x => x.CanWrite).IsRequired();
        assignment.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        assignment.HasOne(x => x.Character).WithMany().HasForeignKey(x => new { x.CampaignId, x.CharacterId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.CampaignMember).WithMany().HasForeignKey(x => new { x.CampaignId, x.UserId }).HasPrincipalKey(x => new { x.CampaignId, x.UserId }).OnDelete(DeleteBehavior.Restrict);

        var formula = modelBuilder.Entity<FormulaMetadata>();
        formula.ToTable("FormulaMetadata", table => table.HasCheckConstraint("CK_FormulaMetadata_MetadataRevision", "MetadataRevision >= 1"));
        formula.HasKey(x => x.Id);
        formula.HasAlternateKey(x => new { x.CampaignId, x.Id });
        formula.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        formula.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        formula.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var view = modelBuilder.Entity<ViewMetadata>();
        view.ToTable("ViewMetadata", table => table.HasCheckConstraint("CK_ViewMetadata_MetadataRevision", "MetadataRevision >= 1"));
        view.HasKey(x => x.Id);
        view.HasAlternateKey(x => new { x.CampaignId, x.Id });
        view.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        view.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        view.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);
    }
}
