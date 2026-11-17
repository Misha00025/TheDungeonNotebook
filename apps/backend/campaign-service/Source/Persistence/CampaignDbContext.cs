using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Campaigns;

namespace Tdn.Campaigns.Persistence;

public sealed class CampaignDbContext(DbContextOptions<CampaignDbContext> options) : DbContext(options)
{
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CampaignMember> CampaignMembers => Set<CampaignMember>();

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
    }
}
