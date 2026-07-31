using System.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class SubjectAccessHelperTests
{
    // ==================== Admin type ====================

    [Fact]
    public void Admin_HasGroupAccess_AlwaysTrue()
    {
        var subject = new Subject(SubjectType.Admin, 999);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.HasGroupAccess(1));
        Assert.True(helper.HasGroupAccess(999));
    }

    [Fact]
    public void Admin_IsAdmin_AlwaysTrue()
    {
        var subject = new Subject(SubjectType.Admin, 999);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.IsAdmin(1));
        Assert.True(helper.IsAdmin(999));
    }

    [Fact]
    public void Admin_HasCharacterAccess_AlwaysTrue()
    {
        var subject = new Subject(SubjectType.Admin, 999);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.HasCharacterAccess(1, 100));
        Assert.True(helper.HasCharacterAccess(999, 999));
    }

    [Fact]
    public void Admin_CanWriteCharacter_AlwaysTrue()
    {
        var subject = new Subject(SubjectType.Admin, 999);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.CanWriteCharacter(1, 100));
        Assert.True(helper.CanWriteCharacter(999, 999));
    }

    [Fact]
    public void Admin_GetAccessibleGroupIds_ReturnsEmptyList()
    {
        var subject = new Subject(SubjectType.Admin, 999);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        var ids = helper.GetAccessibleGroupIds();
        Assert.Empty(ids);
    }

    [Fact]
    public void Admin_GetAccessibleCharacterIds_ReturnsEmptyList()
    {
        var subject = new Subject(SubjectType.Admin, 999);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        var ids = helper.GetAccessibleCharacterIds(1);
        Assert.Empty(ids);
    }

    [Fact]
    public void Admin_CurrentUserId_ReturnsNull()
    {
        var subject = new Subject(SubjectType.Admin, 999);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.Null(helper.CurrentUserId);
    }

    // ==================== Group type ====================

    [Fact]
    public void Group_HasGroupAccess_OwnGroup_ReturnsTrue()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.HasGroupAccess(10));
    }

    [Fact]
    public void Group_HasGroupAccess_OtherGroup_ReturnsFalse()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.False(helper.HasGroupAccess(20));
    }

    [Fact]
    public void Group_IsAdmin_OwnGroup_ReturnsTrue()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.IsAdmin(10));
    }

    [Fact]
    public void Group_HasCharacterAccess_AlwaysTrue()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.HasCharacterAccess(10, 1));
        Assert.True(helper.HasCharacterAccess(10, 999));
    }

    [Fact]
    public void Group_CanWriteCharacter_AlwaysTrue()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.CanWriteCharacter(10, 1));
        Assert.True(helper.CanWriteCharacter(10, 999));
    }

    [Fact]
    public void Group_GetAccessibleGroupIds_ReturnsOwnGroup()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        var ids = helper.GetAccessibleGroupIds();

        Assert.Single(ids, 10);
    }

    [Fact]
    public void Group_GetAccessibleCharacterIds_ReturnsEmptyList()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        var ids = helper.GetAccessibleCharacterIds(10);
        Assert.Empty(ids);
    }

    [Fact]
    public void Group_CurrentUserId_ReturnsNull()
    {
        var subject = new Subject(SubjectType.Group, 10);
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.Null(helper.CurrentUserId);
    }

    // ==================== User type (delegates to GroupAccessHelper = DB) ====================

    [Fact]
    public void User_HasGroupAccess_WhenMember_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.HasGroupAccess(10));
    }

    [Fact]
    public void User_HasGroupAccess_WhenNotMember_ReturnsFalse()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.False(helper.HasGroupAccess(20));
    }

    [Fact]
    public void User_IsAdmin_WhenAdmin_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.IsAdmin(10));
    }

    [Fact]
    public void User_IsAdmin_WhenNotAdmin_ReturnsFalse()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.False(helper.IsAdmin(10));
    }

    [Fact]
    public void User_HasCharacterAccess_WithAccess_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.HasCharacterAccess(10, 100));
    }

    [Fact]
    public void User_CanWriteCharacter_WhenWriter_ReturnsTrue()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = true });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.True(helper.CanWriteCharacter(10, 100));
    }

    [Fact]
    public void User_CanWriteCharacter_WithoutPermission_ReturnsFalse()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = false });
            db.UserCharacters.Add(new UserCharacterData { UserId = 1, GroupId = 10, CharacterId = 100, CanWrite = false });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.False(helper.CanWriteCharacter(10, 100));
    }

    [Fact]
    public void User_CurrentUserId_ReturnsUserId()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var subject = new Subject(SubjectType.User, 42);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        Assert.Equal(42, helper.CurrentUserId);
    }

    [Fact]
    public void User_GetAccessibleGroupIds_ReturnsGroups()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 10, IsAdmin = true });
            db.UserGroups.Add(new UserGroupData { UserId = 1, GroupId = 20, IsAdmin = false });
        });
        var subject = new Subject(SubjectType.User, 1);

        var helper = TestSubjectAccessHelperFactory.Create(ctx, subject);

        var ids = helper.GetAccessibleGroupIds();

        Assert.Equal(2, ids.Count);
        Assert.Contains(10, ids);
        Assert.Contains(20, ids);
    }

    // ==================== No Subject ====================

    [Fact]
    public void NoSubject_HasGroupAccess_ReturnsFalse()
    {
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, null);

        Assert.False(helper.HasGroupAccess(1));
    }

    [Fact]
    public void NoSubject_IsAdmin_ReturnsFalse()
    {
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, null);

        Assert.False(helper.IsAdmin(1));
    }

    [Fact]
    public void NoSubject_HasCharacterAccess_ReturnsFalse()
    {
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, null);

        Assert.False(helper.HasCharacterAccess(1, 100));
    }

    [Fact]
    public void NoSubject_CanWriteCharacter_ReturnsFalse()
    {
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, null);

        Assert.False(helper.CanWriteCharacter(1, 100));
    }

    [Fact]
    public void NoSubject_GetAccessibleGroupIds_ReturnsEmptyList()
    {
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, null);

        var ids = helper.GetAccessibleGroupIds();
        Assert.Empty(ids);
    }

    [Fact]
    public void NoSubject_GetAccessibleCharacterIds_ReturnsEmptyList()
    {
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, null);

        var ids = helper.GetAccessibleCharacterIds(1);
        Assert.Empty(ids);
    }

    [Fact]
    public void NoSubject_CurrentUserId_ReturnsNull()
    {
        var ctx = TestCampaignContextFactory.Create();

        var helper = TestSubjectAccessHelperFactory.Create(ctx, null);

        Assert.Null(helper.CurrentUserId);
    }
}
