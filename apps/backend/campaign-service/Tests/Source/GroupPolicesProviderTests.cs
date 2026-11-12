using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class GroupPolicesProviderTests
{
    // ==================== GetGroupRules ====================

    [Fact]
    public void GetGroupRules_WithUserId_ReturnsOnlyThatUsersRules()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 20, IsAdmin = false });
            db.UserGroups.Add(new UserGroupData { UserId = 2, GroupId = 30, IsAdmin = true });
        });
        var provider = new GroupPolicesProvider(ctx);

        var rules = provider.GetGroupRules(null).ToList();

        Assert.Equal(3, rules.Count);
    }

    [Fact]
    public void GetGroupRules_WithGroupId_ReturnsOnlyThatGroupRules()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserGroups.Add(new UserGroupData { UserId = 2, GroupId = 10, IsAdmin = false });
            db.UserGroups.Add(new UserGroupData { UserId = 3, GroupId = 20, IsAdmin = true });
        });
        var provider = new GroupPolicesProvider(ctx);

        var rules = provider.GetGroupRules(10).ToList();

        Assert.Equal(2, rules.Count);
        Assert.All(rules, r => Assert.Equal(10, r.GroupId));
    }

    [Fact]
    public void GetGroupRules_WithGroupId_ReturnsFilteredRule()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 20, IsAdmin = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var rules = provider.GetGroupRules(10).ToList();

        Assert.Single(rules);
        Assert.Equal(10, rules[0].GroupId);
        Assert.True(rules[0].IsAdmin);
    }

    [Fact]
    public void GetGroupRules_WithoutFilters_ReturnsAllRules()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserGroups.Add(new UserGroupData { UserId = 2, GroupId = 20, IsAdmin = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var rules = provider.GetGroupRules(null).ToList();

        Assert.Equal(2, rules.Count);
    }

    // ==================== UpsertGroupRule ====================

    [Fact]
    public void UpsertGroupRule_CreatesNewRule()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 10, Name = "TestGroup" });
        });
        var provider = new GroupPolicesProvider(ctx);

        var (isCreated, rule) = provider.UpsertGroupRule(10, 1, true);

        Assert.True(isCreated);
        Assert.Equal(10, rule.GroupId);
        Assert.Equal(1, rule.UserId);
        Assert.True(rule.IsAdmin);
    }

    [Fact]
    public void UpsertGroupRule_UpdatesExistingRule()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var (isCreated, rule) = provider.UpsertGroupRule(10, 1, true);

        Assert.False(isCreated);
        Assert.True(rule.IsAdmin);
    }

    [Fact]
    public void UpsertGroupRule_CreatedRuleIsPersisted()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var provider = new GroupPolicesProvider(ctx);

        provider.UpsertGroupRule(10, 1, true);
        var rules = provider.GetGroupRules(null).ToList();

        Assert.Single(rules);
        Assert.True(rules[0].IsAdmin);
    }

    // ==================== GetCharacterRules ====================

    [Fact]
    public void GetCharacterRules_WithGroupId_ReturnsOnlyThatGroupCharacters()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 20, CharacterId = 200, CanWrite = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var rules = provider.GetCharacterRules(10, null).ToList();

        Assert.Single(rules);
        Assert.Equal(10, rules[0].GroupId);
    }

    [Fact]
    public void GetCharacterRules_WithCharacterId_ReturnsFiltered()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 200, CanWrite = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var rules = provider.GetCharacterRules(10, 100).ToList();

        Assert.Single(rules);
        Assert.Equal(100, rules[0].CharacterId);
    }

    // ==================== UpsertCharacterRule ====================

    [Fact]
    public void UpsertCharacterRule_CreatesNewRule()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var result = provider.UpsertCharacterRule(10, 1, 100, true);

        Assert.NotNull(result);
        Assert.True(result!.Value.isCreated);
        Assert.Equal(100, result.Value.rule!.CharacterId);
        Assert.True(result.Value.rule!.CanWrite);
    }

    [Fact]
    public void UpsertCharacterRule_WhenUserNotInGroup_ReturnsNull()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var provider = new GroupPolicesProvider(ctx);

        var result = provider.UpsertCharacterRule(10, 1, 100, true);

        Assert.Null(result);
    }

    [Fact]
    public void UpsertCharacterRule_UpdatesExistingRule()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var result = provider.UpsertCharacterRule(10, 1, 100, true);

        Assert.NotNull(result);
        Assert.False(result!.Value.isCreated);
        Assert.True(result.Value.rule!.CanWrite);
    }

    // ==================== DeleteRule ====================

    [Fact]
    public void DeleteGroupRule_RemovesGroupAndCharacterRules()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
        });
        var provider = new GroupPolicesProvider(ctx);

        var deleted = provider.DeleteRule(1, 10, null);

        Assert.True(deleted);
        Assert.Empty(provider.GetGroupRules(null).ToList());
        Assert.Empty(provider.GetCharacterRules(10, null).ToList());
    }

    [Fact]
    public void DeleteCharacterRule_RemovesOnlyCharacterRule()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 200, CanWrite = false });
        });
        var provider = new GroupPolicesProvider(ctx);

        var deleted = provider.DeleteRule(1, 10, 100);

        Assert.True(deleted);
        Assert.Single(provider.GetGroupRules(null).ToList());
        Assert.Single(provider.GetCharacterRules(10, null).ToList());
    }

    [Fact]
    public void DeleteRule_WhenNotFound_ReturnsFalse()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var provider = new GroupPolicesProvider(ctx);

        Assert.False(provider.DeleteRule(1, 10, null));
    }
}
