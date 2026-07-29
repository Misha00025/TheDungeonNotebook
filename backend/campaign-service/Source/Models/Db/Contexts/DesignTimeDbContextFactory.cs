using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Tdn.Configuration;
using Tdn.Db.Configuers;

namespace Tdn.Db.Contexts;

public class CampaignContextFactory : IDesignTimeDbContextFactory<CampaignContext>
{
    public CampaignContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<CampaignContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new CampaignContext(optionsBuilder.Options, configurer);
    }
}
