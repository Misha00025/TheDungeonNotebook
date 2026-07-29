using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class GroupProviderIntegrationTests
{
    // ========== Связка GroupProvider.Create => GroupPolicesProvider.GetGroupRules ==========

    [Fact]
    public void CreateGroup_WithUserId_CreatesUserGroupRule()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var groupProvider = new GroupProvider(ctx);
        var policesProvider = new GroupPolicesProvider(ctx);

        var group = groupProvider.Create("TestGroup", null, 1);
        
        var rules = policesProvider.GetGroupRules(1, null).ToList();
        
        Assert.Single(rules);
        Assert.Equal(1, rules[0].UserId);
        Assert.Equal(group.Id, rules[0].GroupId);
        Assert.True(rules[0].IsAdmin);
    }

    [Fact]
    public void CreateGroup_WithoutUserId_DoesNotCreateRule()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var groupProvider = new GroupProvider(ctx);
        var policesProvider = new GroupPolicesProvider(ctx);

        groupProvider.Create("TestGroup", null, null);
        
        var rules = policesProvider.GetGroupRules(null, null).ToList();
        
        Assert.Empty(rules);
    }

    [Fact]
    public void CreateGroup_UserCanAccessItImmediately()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var groupProvider = new GroupProvider(ctx);
        var policesProvider = new GroupPolicesProvider(ctx);
        var accessHelper = new GroupAccessHelper(ctx);

        var group = groupProvider.Create("TestGroup", "icon.png", 1);
        
        var hasAccess = accessHelper.HasGroupAccess(group.Id, 1);
        var isAdmin = accessHelper.IsAdmin(group.Id, 1);
        
        Assert.True(hasAccess, "User should have immediate access to created group");
        Assert.True(isAdmin, "Creator should be admin of the group");
    }

    [Fact]
    public void CreateGroup_ThenDelete_RemovesBothGroupAndRule()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var groupProvider = new GroupProvider(ctx);
        var policesProvider = new GroupPolicesProvider(ctx);

        var group = groupProvider.Create("TestGroup", null, 1);
        groupProvider.Delete(group.Id);
        
        var rules = policesProvider.GetGroupRules(1, null).ToList();
        
        Assert.Empty(rules);
    }

    // ========== Связка нескольких групп с одним пользователем ==========

    [Fact]
    public void MultipleGroups_CreatesMultipleRules()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var groupProvider = new GroupProvider(ctx);
        var policesProvider = new GroupPolicesProvider(ctx);

        groupProvider.Create("Group1", null, 1);
        groupProvider.Create("Group2", null, 1);
        groupProvider.Create("Group3", null, 2); // другой пользователь
        
        var user1Rules = policesProvider.GetGroupRules(1, null).ToList();
        var user2Rules = policesProvider.GetGroupRules(2, null).ToList();
        
        Assert.Equal(2, user1Rules.Count);
        Assert.Single(user2Rules);
    }

    // ========== GroupPolicesProvider.UpsertGroupRule => GroupProvider.Get ==========

    [Fact]
    public void UpsertRuleThenGetGroup_GroupExists()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 10, Name = "ExistingGroup", Icon = "icon" });
        });
        var groupProvider = new GroupProvider(ctx);
        var policesProvider = new GroupPolicesProvider(ctx);

        policesProvider.UpsertGroupRule(10, 1, false);
        
        var group = groupProvider.Get(10);
        
        Assert.NotNull(group);
        Assert.Equal("ExistingGroup", group.Name);
        
        var rule = policesProvider.GetGroupRules(1, 10).Single();
        Assert.False(rule.IsAdmin);
    }

    // ========== Удаление group каскадно удаляет UserGroupData (через EF) ==========

    [Fact]
    public void DeleteGroup_CascadesToUserGroupData()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var groupProvider = new GroupProvider(ctx);
        var policesProvider = new GroupPolicesProvider(ctx);

        var group = groupProvider.Create("TestGroup", null, 1);
        var groupId = group.Id;

        groupProvider.Delete(groupId);

        var rules = policesProvider.GetGroupRules(1, null).ToList();
        
        Assert.Empty(rules);
    }

    // ========== AccessHelper + GroupPolicesProvider согласованность ==========

    [Fact]
    public void CreateGroup_AccessHelperConfirmsAdmin()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var groupProvider = new GroupProvider(ctx);
        var accessHelper = new GroupAccessHelper(ctx);

        var group = groupProvider.Create("TestGroup", null, 1);
        
        Assert.True(accessHelper.IsAdmin(group.Id, 1));
        Assert.Contains(group.Id, accessHelper.GetAccessibleGroupIds(1));
    }
}
