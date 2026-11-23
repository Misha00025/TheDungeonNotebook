using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public sealed class CampaignDbContextModelTests
{
    [Fact]
    public void CurrentModelUsesSixSeparateCatalogTablesAndCurrentMigrationCreatesThemOnly()
    {
        using var context = CreateContext();
        Assert.False(context.Database.HasPendingModelChanges());
        var model = context.Model;
        var item = model.FindEntityType(typeof(CatalogEntry<ItemCatalog>))!;
        var skill = model.FindEntityType(typeof(CatalogEntry<SkillCatalog>))!;
        var characterItem = model.FindEntityType(typeof(CharacterCatalogEntry<ItemCatalog>))!;
        var characterSkill = model.FindEntityType(typeof(CharacterCatalogEntry<SkillCatalog>))!;
        var itemReceipt = model.FindEntityType(typeof(CatalogAdditionReceipt<ItemCatalog>))!;
        var skillReceipt = model.FindEntityType(typeof(CatalogAdditionReceipt<SkillCatalog>))!;
        Assert.Equal("ItemDefinitions", item.GetTableName());
        Assert.Equal("SkillDefinitions", skill.GetTableName());
        Assert.Equal("CharacterItems", characterItem.GetTableName());
        Assert.Equal("CharacterSkills", characterSkill.GetTableName());
        Assert.Equal("ItemAdditionReceipts", itemReceipt.GetTableName());
        Assert.Equal("SkillAdditionReceipts", skillReceipt.GetTableName());
        Assert.Null(model.FindEntityType(typeof(CatalogEntry<>)));
        Assert.Null(model.FindEntityType(typeof(CharacterCatalogEntry<>)));
        Assert.Null(model.FindEntityType(typeof(CatalogAdditionReceipt<>)));
        Assert.Null(item.FindProperty("Kind"));
        Assert.Null(skill.FindProperty("Kind"));
        Assert.DoesNotContain(model.GetEntityTypes(), entity => entity.GetProperties().Any(property => property.Name == "CatalogKind"));

        var characterItemCatalogFk = Assert.Single(characterItem.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(CatalogEntry<ItemCatalog>));
        var characterSkillCatalogFk = Assert.Single(characterSkill.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(CatalogEntry<SkillCatalog>));
        Assert.Equal(typeof(CatalogEntry<ItemCatalog>), characterItemCatalogFk.PrincipalEntityType.ClrType);
        Assert.Equal(typeof(CatalogEntry<SkillCatalog>), characterSkillCatalogFk.PrincipalEntityType.ClrType);
        Assert.Equal("decimal(65,28)", characterItem.FindProperty(nameof(CharacterCatalogEntry<ItemCatalog>.Quantity))!.GetColumnType());
        Assert.True(characterItem.FindProperty(nameof(CharacterCatalogEntry<ItemCatalog>.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(characterSkill.FindProperty(nameof(CharacterCatalogEntry<SkillCatalog>.MetadataRevision))!.IsConcurrencyToken);
        Assert.Equal(new[] { "CampaignId", "CharacterId", "RequestId" }, itemReceipt.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { "CampaignId", "CharacterId", "RequestId" }, skillReceipt.FindPrimaryKey()!.Properties.Select(x => x.Name));

        var migrator = context.Database.GetService<IMigrator>();
        var script = migrator.GenerateScript();
        foreach (var table in new[] { "ItemDefinitions", "CharacterItems", "ItemAdditionReceipts", "SkillDefinitions", "CharacterSkills", "SkillAdditionReceipts" })
            Assert.Contains($"CREATE TABLE `{table}`", script);
        Assert.DoesNotContain("INSERT INTO `ItemDefinitions`", script);
        Assert.DoesNotContain("INSERT INTO `SkillDefinitions`", script);
        Assert.DoesNotContain("DROP TABLE `Campaigns`", script);

        var newCatalog = migrator.GenerateScript("20261121000200_CharacterCatalog", "20261123000100_SeparateCatalogs");
        Assert.Contains("CREATE TABLE `ItemDefinitions`", newCatalog);
        Assert.Contains("CREATE TABLE `CharacterItems`", newCatalog);
        Assert.Contains("CREATE TABLE `ItemAdditionReceipts`", newCatalog);
        Assert.Contains("CREATE TABLE `SkillDefinitions`", newCatalog);
        Assert.Contains("CREATE TABLE `CharacterSkills`", newCatalog);
        Assert.Contains("CREATE TABLE `SkillAdditionReceipts`", newCatalog);
        foreach (var table in new[] { "ItemDefinitions", "CharacterItems", "ItemAdditionReceipts", "SkillDefinitions", "CharacterSkills", "SkillAdditionReceipts" })
            Assert.DoesNotContain($"INSERT INTO `{table}`", newCatalog);
        foreach (var table in new[] { "CatalogEntries", "CharacterCatalogEntries", "CatalogAdditionReceipts" })
            Assert.DoesNotContain($"FROM `{table}`", newCatalog);
        var migrationAssembly = context.GetService<IMigrationsAssembly>();
        var migration = migrationAssembly.Migrations["20261123000100_SeparateCatalogs"];
        var separateCatalogs = (Migration)migrationAssembly.CreateMigration(migration, context.Database.ProviderName!);
        Assert.All(separateCatalogs.UpOperations, operation => Assert.True(operation is CreateTableOperation or CreateIndexOperation));
        Assert.DoesNotContain("DROP TABLE", newCatalog);
        Assert.DoesNotContain("CampaignTemplates", newCatalog);
        Assert.DoesNotContain("CREATE TABLE `CharacterMetadata`", newCatalog);
        Assert.DoesNotContain("ALTER TABLE `CharacterMetadata`", newCatalog);
        Assert.DoesNotContain("DROP TABLE `CharacterMetadata`", newCatalog);
        Assert.Contains("REFERENCES `CharacterMetadata`", newCatalog);

        var historical = migrator.GenerateScript("20261118000100_CampaignTemplate", "20261121000200_CharacterCatalog");
        Assert.Contains("CREATE TABLE `CatalogEntries`", historical);
        Assert.Contains("CREATE TABLE `CharacterCatalogEntries`", historical);
        Assert.Contains("CREATE TABLE `CatalogAdditionReceipts`", historical);
        Assert.DoesNotContain("DROP TABLE", historical);
    }

    [Fact]
    public void SeparateCatalogMigrationTargetModelIsFrozenAndMatchesSnapshot()
    {
        using var context = CreateContext();
        var migrations = context.GetService<IMigrationsAssembly>();
        var migration = migrations.Migrations["20261123000100_SeparateCatalogs"];
        var instance = migrations.CreateMigration(migration, context.Database.ProviderName!);
        var frozenTarget = instance.TargetModel;
        var snapshot = context.GetService<IDesignTimeModel>().Model;
        foreach (var type in new[] { typeof(CatalogEntry<ItemCatalog>), typeof(CatalogEntry<SkillCatalog>), typeof(CharacterCatalogEntry<ItemCatalog>), typeof(CharacterCatalogEntry<SkillCatalog>), typeof(CatalogAdditionReceipt<ItemCatalog>), typeof(CatalogAdditionReceipt<SkillCatalog>) })
            Assert.Equal(snapshot.FindEntityType(type)!.GetTableName(), frozenTarget.FindEntityType(type)!.GetTableName());
        Assert.NotSame(snapshot, frozenTarget);
        Assert.Null(frozenTarget.FindEntityType(typeof(CatalogEntry<>)));
        Assert.Null(frozenTarget.FindEntityType(typeof(CharacterCatalogEntry<>)));
        Assert.Null(frozenTarget.FindEntityType(typeof(CatalogAdditionReceipt<>)));
    }

    [Fact]
    public void UnaffectedCampaignSheetFormulaAndViewMappingsRemainPresent()
    {
        using var context = CreateContext();
        var model = context.Model;
        var campaign = model.FindEntityType(typeof(Campaign))!;
        var member = model.FindEntityType(typeof(CampaignMember))!;
        var template = model.FindEntityType(typeof(TemplateMetadata))!;
        var character = model.FindEntityType(typeof(CharacterMetadata))!;
        var assignment = model.FindEntityType(typeof(CharacterAssignment))!;
        var formula = model.FindEntityType(typeof(FormulaMetadata))!;
        var view = model.FindEntityType(typeof(ViewMetadata))!;
        Assert.Equal("Campaigns", campaign.GetTableName());
        Assert.Equal("CampaignMembers", member.GetTableName());
        Assert.Equal("CampaignTemplates", template.GetTableName());
        Assert.Equal("CharacterMetadata", character.GetTableName());
        Assert.Equal("CharacterAssignments", assignment.GetTableName());
        Assert.Equal("FormulaMetadata", formula.GetTableName());
        Assert.Equal("ViewMetadata", view.GetTableName());
        Assert.Equal(new[] { nameof(Campaign.Id) }, campaign.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CampaignMember.CampaignId), nameof(CampaignMember.UserId) }, member.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(TemplateMetadata.CampaignId) }, template.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CharacterMetadata.Id) }, character.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CharacterMetadata.CampaignId), nameof(CharacterMetadata.Id) }, character.GetKeys().Single(x => !x.IsPrimaryKey()).Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CharacterAssignment.CampaignId), nameof(CharacterAssignment.CharacterId), nameof(CharacterAssignment.UserId) }, assignment.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(FormulaMetadata.Id) }, formula.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(FormulaMetadata.CampaignId), nameof(FormulaMetadata.Id) }, formula.GetKeys().Single(x => !x.IsPrimaryKey()).Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(ViewMetadata.Id) }, view.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(ViewMetadata.CampaignId), nameof(ViewMetadata.Id) }, view.GetKeys().Single(x => !x.IsPrimaryKey()).Properties.Select(x => x.Name));
        Assert.True(Assert.Single(campaign.GetIndexes()).IsUnique);
        Assert.Equal(new[] { nameof(Campaign.CreationRequestId) }, Assert.Single(campaign.GetIndexes()).Properties.Select(x => x.Name));
        Assert.Contains(member.GetIndexes(), x => x.Properties.Select(p => p.Name).SequenceEqual([nameof(CampaignMember.UserId)]));
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(member.GetForeignKeys()).DeleteBehavior);
        Assert.Equal(new[] { nameof(CampaignMember.CampaignId) }, Assert.Single(member.GetForeignKeys()).Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(template.GetForeignKeys()).DeleteBehavior);
        Assert.Equal(new[] { nameof(TemplateMetadata.CampaignId) }, Assert.Single(template.GetForeignKeys()).Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(character.GetForeignKeys()).DeleteBehavior);
        Assert.Equal(new[] { nameof(CharacterMetadata.CampaignId) }, Assert.Single(character.GetForeignKeys()).Properties.Select(x => x.Name));
        Assert.Equal(2, assignment.GetForeignKeys().Count());
        Assert.All(assignment.GetForeignKeys(), x => Assert.Equal(DeleteBehavior.Restrict, x.DeleteBehavior));
        Assert.Contains(assignment.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(CharacterMetadata) && x.Properties.Select(p => p.Name).SequenceEqual([nameof(CharacterAssignment.CampaignId), nameof(CharacterAssignment.CharacterId)]));
        Assert.Contains(assignment.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(CampaignMember) && x.Properties.Select(p => p.Name).SequenceEqual([nameof(CharacterAssignment.CampaignId), nameof(CharacterAssignment.UserId)]));
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(formula.GetForeignKeys()).DeleteBehavior);
        Assert.Equal(new[] { nameof(FormulaMetadata.CampaignId) }, Assert.Single(formula.GetForeignKeys()).Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(view.GetForeignKeys()).DeleteBehavior);
        Assert.Equal(new[] { nameof(ViewMetadata.CampaignId) }, Assert.Single(view.GetForeignKeys()).Properties.Select(x => x.Name));
        Assert.True(campaign.FindProperty(nameof(Campaign.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(member.FindProperty(nameof(CampaignMember.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(template.FindProperty(nameof(TemplateMetadata.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(character.FindProperty(nameof(CharacterMetadata.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(assignment.FindProperty(nameof(CharacterAssignment.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(formula.FindProperty(nameof(FormulaMetadata.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(view.FindProperty(nameof(ViewMetadata.MetadataRevision))!.IsConcurrencyToken);

        AssertCatalogMappings<ItemCatalog>(model);
        AssertCatalogMappings<SkillCatalog>(model);
    }

    private static void AssertCatalogMappings<TCatalog>(IModel model) where TCatalog : ICatalogType
    {
        var definition = model.FindEntityType(typeof(CatalogEntry<TCatalog>))!;
        var local = model.FindEntityType(typeof(CharacterCatalogEntry<TCatalog>))!;
        var receipt = model.FindEntityType(typeof(CatalogAdditionReceipt<TCatalog>))!;
        Assert.Equal(new[] { nameof(CatalogEntry<TCatalog>.Id) }, definition.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CatalogEntry<TCatalog>.CampaignId), nameof(CatalogEntry<TCatalog>.Id) }, definition.GetKeys().Single(x => !x.IsPrimaryKey()).Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CharacterCatalogEntry<TCatalog>.Id) }, local.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CatalogAdditionReceipt<TCatalog>.CampaignId), nameof(CatalogAdditionReceipt<TCatalog>.CharacterId), nameof(CatalogAdditionReceipt<TCatalog>.RequestId) }, receipt.FindPrimaryKey()!.Properties.Select(x => x.Name));
        Assert.Equal(new[] { nameof(CharacterCatalogEntry<TCatalog>.CampaignId), nameof(CharacterCatalogEntry<TCatalog>.CharacterId), nameof(CharacterCatalogEntry<TCatalog>.CatalogEntryId) }, local.GetIndexes().Single(x => x.Properties.Select(p => p.Name).SequenceEqual([nameof(CharacterCatalogEntry<TCatalog>.CampaignId), nameof(CharacterCatalogEntry<TCatalog>.CharacterId), nameof(CharacterCatalogEntry<TCatalog>.CatalogEntryId)])).Properties.Select(x => x.Name));
        Assert.Contains(local.GetIndexes(), x => x.Properties.Select(p => p.Name).SequenceEqual([nameof(CharacterCatalogEntry<TCatalog>.CampaignId), nameof(CharacterCatalogEntry<TCatalog>.CatalogEntryId)]));
        Assert.Contains(definition.GetIndexes(), x => x.Properties.Select(p => p.Name).SequenceEqual([nameof(CatalogEntry<TCatalog>.CampaignId)]));
        var definitionCampaignFk = Assert.Single(definition.GetForeignKeys());
        Assert.Equal(typeof(Campaign), definitionCampaignFk.PrincipalEntityType.ClrType);
        Assert.Equal(new[] { nameof(CatalogEntry<TCatalog>.CampaignId) }, definitionCampaignFk.Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, definitionCampaignFk.DeleteBehavior);
        Assert.Equal(2, local.GetForeignKeys().Count());
        var definitionFk = Assert.Single(local.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(CatalogEntry<TCatalog>));
        Assert.Equal(new[] { nameof(CharacterCatalogEntry<TCatalog>.CampaignId), nameof(CharacterCatalogEntry<TCatalog>.CatalogEntryId) }, definitionFk.Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, definitionFk.DeleteBehavior);
        var characterFk = Assert.Single(local.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(CharacterMetadata));
        Assert.Equal(new[] { nameof(CharacterCatalogEntry<TCatalog>.CampaignId), nameof(CharacterCatalogEntry<TCatalog>.CharacterId) }, characterFk.Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, characterFk.DeleteBehavior);
        Assert.Equal("decimal(65,28)", local.FindProperty(nameof(CharacterCatalogEntry<TCatalog>.Quantity))!.GetColumnType());
        Assert.True(definition.FindProperty(nameof(CatalogEntry<TCatalog>.MetadataRevision))!.IsConcurrencyToken);
        Assert.True(local.FindProperty(nameof(CharacterCatalogEntry<TCatalog>.MetadataRevision))!.IsConcurrencyToken);
        Assert.DoesNotContain(receipt.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(CatalogEntry<TCatalog>));
        Assert.Single(receipt.GetForeignKeys());
        var receiptCharacterFk = Assert.Single(receipt.GetForeignKeys());
        Assert.Equal(typeof(CharacterMetadata), receiptCharacterFk.PrincipalEntityType.ClrType);
        Assert.Equal(new[] { nameof(CatalogAdditionReceipt<TCatalog>.CampaignId), nameof(CatalogAdditionReceipt<TCatalog>.CharacterId) }, receiptCharacterFk.Properties.Select(x => x.Name));
        Assert.Equal(DeleteBehavior.Restrict, receiptCharacterFk.DeleteBehavior);
        Assert.Null(definition.FindProperty("Kind"));
        Assert.Null(local.FindProperty("Kind"));
        Assert.Null(receipt.FindProperty("Kind"));
    }

    private static CampaignDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<CampaignDbContext>()
            .UseMySql("Server=127.0.0.1;Database=unit_unused;User ID=unit_placeholder;", new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;
        return new CampaignDbContext(options);
    }
}
