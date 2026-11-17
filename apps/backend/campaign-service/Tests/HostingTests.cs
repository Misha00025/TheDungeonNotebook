using Microsoft.Extensions.Configuration;
using Tdn.Campaigns;

namespace CampaignService.Tests;

public class HostingTests
{
    [Fact]
    public async Task BuildUsesCommandLineUrlsAndRegistersConfiguration()
    {
        await using var app = CampaignApplication.Build(["--urls", "http://127.0.0.1:5099"]);

        Assert.Equal("http://127.0.0.1:5099", app.Configuration["urls"]);
        Assert.IsAssignableFrom<IConfiguration>(app.Configuration);
    }

    [Fact]
    public async Task BuildAddsCommandLineValuesToConfiguration()
    {
        await using var app = CampaignApplication.Build(["--Example:Value", "configured"]);

        Assert.Equal("configured", app.Configuration["Example:Value"]);
    }
}
