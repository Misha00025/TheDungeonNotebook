using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;

namespace CampaignService.Tests;

public class CampaignDbContextModelTests
{
    [Fact]
    public void ModelMatchesSnapshotAndMigrationScriptCreatesBothTablesWithoutConnecting()
    {
        var options = new DbContextOptionsBuilder<CampaignDbContext>()
            .UseMySql("Server=localhost;Database=unused;User Id=unused;Password=unused", new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;
        using var context = new CampaignDbContext(options);

        Assert.False(context.Database.HasPendingModelChanges());
        var script = context.Database.GetService<IMigrator>().GenerateScript();

        Assert.Contains("CREATE TABLE `Campaigns`", script);
        Assert.Contains("CREATE TABLE `CampaignMembers`", script);
    }

    [Fact]
    public void ModelDefinesKeysIndexesConcurrencyAndRestrictRelationship()
    {
        var options = new DbContextOptionsBuilder<CampaignDbContext>()
            .UseMySql("Server=localhost;Database=unused;User Id=unused;Password=unused", new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;
        using var context = new CampaignDbContext(options);
        var model = context.Model;
        var campaign = model.FindEntityType(typeof(Campaign))!;
        var member = model.FindEntityType(typeof(CampaignMember))!;

        Assert.Equal(new[] { "Id" }, campaign.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(campaign.GetIndexes(), index => index.IsUnique && index.Properties.Select(x => x.Name).SequenceEqual(new[] { "CreationRequestId" }));
        Assert.True(campaign.FindProperty(nameof(Campaign.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(new[] { "CampaignId", "UserId" }, member.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(member.GetIndexes(), index => index.Properties.Select(x => x.Name).SequenceEqual(new[] { "UserId" }));
        Assert.True(member.FindProperty(nameof(CampaignMember.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(member.GetForeignKeys()).DeleteBehavior);
    }
}
