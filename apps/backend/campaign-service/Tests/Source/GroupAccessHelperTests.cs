using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class GroupAccessHelperTests
{
    [Fact]
    public void GetAccessibleGroupIds_ReturnsGroupsForUser()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 20, IsAdmin = false });
        });
        var helper = new GroupAccessHelper(ctx);
        
        var ids = helper.GetAccessibleGroupIds(1);
        
        Assert.Contains(10, ids);
        Assert.Contains(20, ids);
        Assert.Equal(2, ids.Count);
    }

    [Fact]
    public void HasGroupAccess_WhenUserHasAccess_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
        });
        var helper = new GroupAccessHelper(ctx);
        
        Assert.True(helper.HasGroupAccess(10, 1));
    }

    [Fact]
    public void HasGroupAccess_WhenNoAccess_ReturnsFalse()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var helper = new GroupAccessHelper(ctx);
        
        Assert.False(helper.HasGroupAccess(10, 1));
    }

    [Fact]
    public void IsAdmin_WhenUserIsAdmin_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
        });
        var helper = new GroupAccessHelper(ctx);
        
        Assert.True(helper.IsAdmin(10, 1));
    }

    [Fact]
    public void HasCharacterAccess_WhenGroupAdmin_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
        });
        var helper = new GroupAccessHelper(ctx);
        
        Assert.True(helper.HasCharacterAccess(10, 100, 1));
    }

    [Fact]
    public void HasCharacterAccess_WhenExplicitAccess_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 2, GroupId = 10, IsAdmin = false });
            db.UserCharacters.Add(new UserCharacterData { UserId = 2, GroupId = 10, CharacterId = 100, CanWrite = true });
        });
        var helper = new GroupAccessHelper(ctx);
        
        Assert.True(helper.HasCharacterAccess(10, 100, 2));
    }

    [Fact]
    public void GetAccessibleCharacterIds_ReturnsCharactersForUser()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 200, CanWrite = false });
        });
        var helper = new GroupAccessHelper(ctx);
        
        var ids = helper.GetAccessibleCharacterIds(10, 1);
        
        Assert.Contains(100, ids);
        Assert.Contains(200, ids);
    }

    [Fact]
    public void CanWriteCharacter_WhenHasWritePermission_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
        });
        var helper = new GroupAccessHelper(ctx);
        
        Assert.True(helper.CanWriteCharacter(10, 100, 1));
    }

    [Fact]
    public void CanWriteCharacter_WhenAdmin_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
        });
        var helper = new GroupAccessHelper(ctx);
        
        Assert.True(helper.CanWriteCharacter(10, 100, 1));
    }

    [Fact]
    public void CanWriteCharacter_WithoutPermission_ReturnsFalse()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = false });
        });
        var helper = new GroupAccessHelper(ctx);
        
        Assert.False(helper.CanWriteCharacter(10, 100, 1));
    }
}
