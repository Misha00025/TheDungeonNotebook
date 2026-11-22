using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
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
        Assert.Contains("CREATE TABLE `CatalogEntries`", script);
        Assert.Contains("CREATE TABLE `CharacterCatalogEntries`", script);
        Assert.Contains("CREATE TABLE `CatalogAdditionReceipts`", script);

        var forward = context.Database.GetService<IMigrator>().GenerateScript("20261117000500_Views", "20261118000100_CampaignTemplate");
        Assert.Contains("DROP COLUMN `TemplateId`", forward);
        Assert.Contains("DROP TABLE `TemplateMetadata`", forward);
        Assert.Contains("CREATE TABLE `CampaignTemplates`", forward);
        Assert.Contains("PRIMARY KEY (`CampaignId`)", forward);
        Assert.Contains("INSERT INTO `CampaignTemplates` (`CampaignId`, `Name`, `MetadataRevision`) SELECT `Id`, `Name`, 1 FROM `Campaigns`", forward);

        var catalogForward = context.Database.GetService<IMigrator>().GenerateScript("20261118000100_CampaignTemplate", "20261121000100_Catalog");
        Assert.Contains("CREATE TABLE `CatalogEntries`", catalogForward);
        Assert.DoesNotContain("DROP TABLE", catalogForward);
        Assert.DoesNotContain("DROP COLUMN", catalogForward);

        var characterCatalogForward = context.Database.GetService<IMigrator>().GenerateScript("20261121000100_Catalog", "20261121000200_CharacterCatalog");
        Assert.Contains("CREATE TABLE `CharacterCatalogEntries`", characterCatalogForward);
        Assert.Contains("CREATE TABLE `CatalogAdditionReceipts`", characterCatalogForward);
        Assert.DoesNotContain("DROP TABLE", characterCatalogForward);
        Assert.DoesNotContain("DROP COLUMN", characterCatalogForward);
        Assert.Contains("decimal(65,28)", characterCatalogForward);
        Assert.Contains("CK_CharacterCatalogEntries_MetadataRevision", characterCatalogForward);
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
        var catalogEntry = model.FindEntityType(typeof(CatalogEntry))!;
        var characterCatalogEntry = model.FindEntityType(typeof(CharacterCatalogEntry))!;
        var additionReceipt = model.FindEntityType(typeof(CatalogAdditionReceipt))!;

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

        Assert.Equal(new[] { "Id" }, catalogEntry.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Contains(catalogEntry.GetKeys(), key => key.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Id" }));
        Assert.True(catalogEntry.FindProperty(nameof(CatalogEntry.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(catalogEntry.FindProperty(nameof(CatalogEntry.CreatorUserId))!.IsNullable);
        Assert.True(catalogEntry.FindProperty(nameof(CatalogEntry.QuantityUnit))!.IsNullable);
        Assert.Contains(catalogEntry.GetIndexes(), index => index.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Kind" }));
        var catalogCampaign = Assert.Single(catalogEntry.GetForeignKeys());
        Assert.Equal(typeof(Campaign), catalogCampaign.PrincipalEntityType.ClrType);
        Assert.Equal(new[] { "CampaignId" }, catalogCampaign.Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, catalogCampaign.DeleteBehavior);

        Assert.Equal(new[] { "Id" }, characterCatalogEntry.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(ValueGenerated.Never, characterCatalogEntry.FindProperty(nameof(CharacterCatalogEntry.Id))!.ValueGenerated);
        Assert.True(characterCatalogEntry.FindProperty(nameof(CharacterCatalogEntry.MetadataRevision))!.IsConcurrencyToken);
        var designTimeCharacterCatalogEntry = context.GetService<IDesignTimeModel>().Model.FindEntityType(typeof(CharacterCatalogEntry))!;
        Assert.Contains(designTimeCharacterCatalogEntry.GetCheckConstraints(), check => check.Name == "CK_CharacterCatalogEntries_MetadataRevision" && check.Sql == "MetadataRevision >= 1");
        Assert.True(characterCatalogEntry.FindProperty(nameof(CharacterCatalogEntry.Quantity))!.IsNullable);
        Assert.Equal("decimal(65,28)", characterCatalogEntry.FindProperty(nameof(CharacterCatalogEntry.Quantity))!.GetColumnType());
        Assert.Contains(characterCatalogEntry.GetIndexes(), index => index.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "CharacterId", "CatalogEntryId" }));
        Assert.Contains(characterCatalogEntry.GetIndexes(), index => index.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "CatalogEntryId" }));
        Assert.Contains(characterCatalogEntry.GetForeignKeys(), foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(CharacterMetadata) &&
            foreignKey.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "CharacterId" }) &&
            foreignKey.PrincipalKey.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Id" }) && foreignKey.DeleteBehavior == DeleteBehavior.Restrict);
        Assert.Contains(characterCatalogEntry.GetForeignKeys(), foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(CatalogEntry) &&
            foreignKey.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "CatalogEntryId" }) &&
            foreignKey.PrincipalKey.Properties.Select(x => x.Name).SequenceEqual(new[] { "CampaignId", "Id" }) && foreignKey.DeleteBehavior == DeleteBehavior.Restrict);

        Assert.Equal(new[] { "CampaignId", "CharacterId", "RequestId" }, additionReceipt.FindPrimaryKey()!.Properties.Select(x => x.Name));
        var receiptCharacter = Assert.Single(additionReceipt.GetForeignKeys());
        Assert.Equal(typeof(CharacterMetadata), receiptCharacter.PrincipalEntityType.ClrType);
        Assert.Equal(new[] { "CampaignId", "CharacterId" }, receiptCharacter.Properties.Select(x => x.Name));
        Assert.Equal(new[] { "CampaignId", "Id" }, receiptCharacter.PrincipalKey.Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, receiptCharacter.DeleteBehavior);
        Assert.DoesNotContain(additionReceipt.GetForeignKeys(), foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(CatalogEntry));
        Assert.DoesNotContain(additionReceipt.GetForeignKeys(), foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(CharacterCatalogEntry));
    }
}
