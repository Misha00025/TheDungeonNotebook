using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public class CampaignDbContextModelTests
{
    [Fact]
    public void ModelMatchesSnapshotAndMigrationScriptCreatesAllTablesWithoutConnecting()
    {
        var options = new DbContextOptionsBuilder<CampaignDbContext>()
            .UseMySql("Server=localhost;Database=unused;User Id=unused;Password=unused", new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;
        using var context = new CampaignDbContext(options);

        Assert.False(context.Database.HasPendingModelChanges());
        var script = context.Database.GetService<IMigrator>().GenerateScript();

        Assert.Contains("CREATE TABLE `Campaigns`", script);
        Assert.Contains("CREATE TABLE `CampaignMembers`", script);
        Assert.Contains("CREATE TABLE `CampaignTemplates`", script);
        Assert.Contains("CREATE TABLE `CharacterMetadata`", script);
        Assert.Contains("CREATE TABLE `CharacterAssignments`", script);
        Assert.Contains("CREATE TABLE `FormulaMetadata`", script);
        Assert.Contains("CREATE TABLE `ViewMetadata`", script);

        var forward = context.Database.GetService<IMigrator>().GenerateScript("20261117000500_Views", "20261118000100_CampaignTemplate");
        Assert.Contains("DROP COLUMN `TemplateId`", forward);
        Assert.Contains("DROP TABLE `TemplateMetadata`", forward);
        Assert.Contains("CREATE TABLE `CampaignTemplates`", forward);
        Assert.Contains("PRIMARY KEY (`CampaignId`)", forward);
        Assert.Contains("INSERT INTO `CampaignTemplates` (`CampaignId`, `Name`, `MetadataRevision`) SELECT `Id`, `Name`, 1 FROM `Campaigns`", forward);
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
        var template = model.FindEntityType(typeof(TemplateMetadata))!;
        var character = model.FindEntityType(typeof(CharacterMetadata))!;
        var assignment = model.FindEntityType(typeof(CharacterAssignment))!;
        var formula = model.FindEntityType(typeof(FormulaMetadata))!;
        var view = model.FindEntityType(typeof(ViewMetadata))!;

        Assert.Equal(new[] { "Id" }, campaign.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(campaign.GetIndexes(), index => index.IsUnique && index.Properties.Select(x => x.Name).SequenceEqual(new[] { "CreationRequestId" }));
        Assert.True(campaign.FindProperty(nameof(Campaign.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(new[] { "CampaignId", "UserId" }, member.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(member.GetIndexes(), index => index.Properties.Select(x => x.Name).SequenceEqual(new[] { "UserId" }));
        Assert.True(member.FindProperty(nameof(CampaignMember.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(member.GetForeignKeys()).DeleteBehavior);

        Assert.Equal(new[] { "CampaignId" }, template.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(ValueGenerated.Never, template.FindProperty(nameof(TemplateMetadata.CampaignId))!.ValueGenerated);
        Assert.Null(template.FindProperty("Id"));
        Assert.True(template.FindProperty(nameof(TemplateMetadata.MetadataRevision))!.IsConcurrencyToken);
        var templateCampaign = Assert.Single(template.GetForeignKeys());
        Assert.Equal(typeof(Campaign), templateCampaign.PrincipalEntityType.ClrType);
        Assert.Equal(new[] { "CampaignId" }, templateCampaign.Properties.Select(x => x.Name));
        Assert.True(templateCampaign.IsUnique);
        Assert.Equal(DeleteBehavior.Restrict, templateCampaign.DeleteBehavior);
        Assert.Same(template, campaign.FindNavigation(nameof(Campaign.Template))!.TargetEntityType);

        Assert.Equal(new[] { "Id" }, character.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(character.GetKeys(), key => key.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Id" }));
        Assert.True(character.FindProperty(nameof(CharacterMetadata.MetadataRevision))!.IsConcurrencyToken);
        Assert.Single(character.GetForeignKeys());
        Assert.All(character.GetForeignKeys(), foreignKey => Assert.Equal(DeleteBehavior.Restrict, foreignKey.DeleteBehavior));
        Assert.DoesNotContain(character.GetForeignKeys(), foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(TemplateMetadata));
        Assert.Null(character.FindProperty("TemplateId"));
        Assert.Null(character.FindNavigation("Template"));

        Assert.Equal(new[] { "CampaignId", "CharacterId", "UserId" }, assignment.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.True(assignment.FindProperty(nameof(CharacterAssignment.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(2, assignment.GetForeignKeys().Count());
        Assert.All(assignment.GetForeignKeys(), foreignKey => Assert.Equal(DeleteBehavior.Restrict, foreignKey.DeleteBehavior));
        Assert.Contains(assignment.GetForeignKeys(), foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(CampaignMember) &&
            foreignKey.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "UserId" }));
        Assert.Contains(assignment.GetForeignKeys(), foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(CharacterMetadata) &&
            foreignKey.PrincipalKey.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Id" }));
        Assert.Contains(assignment.GetIndexes(), index => index.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "UserId" }));

        Assert.Equal(new[] { "Id" }, formula.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(formula.GetKeys(), key => key.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Id" }));
        Assert.True(formula.FindProperty(nameof(FormulaMetadata.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(formula.GetForeignKeys()).DeleteBehavior);

        Assert.Equal(new[] { "Id" }, view.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(view.GetKeys(), key => key.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Id" }));
        Assert.True(view.FindProperty(nameof(ViewMetadata.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(view.GetForeignKeys()).DeleteBehavior);
    }
}
