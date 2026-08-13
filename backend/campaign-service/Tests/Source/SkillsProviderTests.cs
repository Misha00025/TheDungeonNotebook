using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Models;
using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class SkillsProviderTests
{
    [Fact]
    public void GetSkills_ReturnsAllGroupSkills()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Skills.Add(new SkillData { Id = 10, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
            db.Skills.Add(new SkillData { Id = 20, GroupId = 1, UUID = ObjectId.GenerateNewId().ToString() });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<SkillMongoData>("skills", It.IsAny<string>()))
            .Returns(new SkillMongoData { Name = "Skill", Description = "Desc" });
        var attrsMock = new Mock<AttributesProvider>(MockBehavior.Loose, mongoMock.Object);
        var loggerMock = new Mock<ILogger<SkillsProvider>>();
        
        var provider = new SkillsProvider(ctx, mongoMock.Object, attrsMock.Object, loggerMock.Object);
        
        var skills = provider.GetSkills(1);
        
        Assert.Equal(2, skills.Count());
    }

    [Fact]
    public void GetSkill_WhenExists_ReturnsSkill()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Skills.Add(new SkillData { Id = 10, GroupId = 1, UUID = uuid });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<SkillMongoData>("skills", uuid))
            .Returns(new SkillMongoData { Name = "Stealth", Description = "Move silently" });
        var attrsMock = new Mock<AttributesProvider>(MockBehavior.Loose, mongoMock.Object);
        var loggerMock = new Mock<ILogger<SkillsProvider>>();
        
        var provider = new SkillsProvider(ctx, mongoMock.Object, attrsMock.Object, loggerMock.Object);
        
        var skill = provider.GetSkill(1, 10);
        
        Assert.NotNull(skill);
        Assert.Equal("Stealth", skill.Name);
    }
}
