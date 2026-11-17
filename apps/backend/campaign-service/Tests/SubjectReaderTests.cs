using Tdn.Campaigns.Access;

namespace CampaignService.Tests;

public class SubjectReaderTests
{
    [Theory]
    [InlineData("{\"type\":\"user\",\"id\":17}", SubjectType.User, 17)]
    [InlineData("{\"TYPE\":\"GROUP\",\"ID\":-8}", SubjectType.Group, -8)]
    [InlineData("{\"Type\":2,\"Id\":3}", SubjectType.Admin, 3)]
    [InlineData("{\"type\":99,\"id\":3}", (SubjectType)99, 3)]
    public void ParsesCaseInsensitiveStringAndNumericSubjects(string json, SubjectType type, int id)
    {
        Assert.Equal(new Subject(type, id), SubjectReader.Parse(json));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("invalid")]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{\"type\":\"User\"}")]
    [InlineData("{\"id\":1}")]
    public void InvalidOrIncompleteSubjectsReturnNull(string? json)
    {
        Assert.Null(SubjectReader.Parse(json));
    }
}
