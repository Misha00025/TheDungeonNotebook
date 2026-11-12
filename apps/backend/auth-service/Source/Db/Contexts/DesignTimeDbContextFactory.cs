using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Tdn.Configuration;
using Tdn.Db.Configuers;

namespace Tdn.Db.Contexts;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<LoginContext>
{
    public LoginContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<LoginContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new LoginContext(optionsBuilder.Options, configurer);
    }
}
