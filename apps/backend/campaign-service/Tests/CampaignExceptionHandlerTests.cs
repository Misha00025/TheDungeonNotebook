using Microsoft.AspNetCore.Http;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Http;
using Tdn.Campaigns.Sheets;

namespace CampaignService.Tests;

public class CampaignExceptionHandlerTests
{
    [Fact]
    public async Task MongoWriteOutcomeUsesSafe503Code()
    {
        var context = new DefaultHttpContext();
        await using var body = new MemoryStream();
        context.Response.Body = body;

        var handled = await new CampaignExceptionHandler().TryHandleAsync(context, new ContentStoreException(true), default);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, context.Response.StatusCode);
        body.Position = 0;
        using var reader = new StreamReader(body);
        var response = await reader.ReadToEndAsync();
        Assert.Contains("content_write_outcome_unknown", response);
        Assert.DoesNotContain("connection", response, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MemberAssignmentRestrictionRemainsA409DomainError()
    {
        var context = new DefaultHttpContext();
        await using var body = new MemoryStream();
        context.Response.Body = body;

        var handled = await new CampaignExceptionHandler().TryHandleAsync(context,
            new DomainException(409, "member_has_assignments", "The campaign member still has restrictive references.", 7), default);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        body.Position = 0;
        using var reader = new StreamReader(body);
        Assert.Contains("member_has_assignments", await reader.ReadToEndAsync());
    }
}
