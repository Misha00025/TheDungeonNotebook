namespace Tdn.Tests.Fixtures;

public static class TestCampaignContextFactory
{
    public static CampaignContext Create()
    {
        var options = new DbContextOptionsBuilder<CampaignContext>()
            .UseInMemoryDatabase($"test-{Guid.NewGuid()}")
            .Options;
        var configurer = new EntityBuildersConfigurer();
        return new CampaignContext(options, configurer);
    }
    
    public static CampaignContext CreateWithData(Action<CampaignContext> seed)
    {
        var ctx = Create();
        seed(ctx);
        ctx.SaveChanges();
        return ctx;
    }
}
