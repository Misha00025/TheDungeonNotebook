using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Tdn.Configuration;
using Tdn.Db.Configuers;

namespace Tdn.Db.Contexts;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<UserContext>
{
    public UserContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<UserContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new UserContext(optionsBuilder.Options, configurer);
    }
}
