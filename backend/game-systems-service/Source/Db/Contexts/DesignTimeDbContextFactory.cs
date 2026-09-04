using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Tdn.Configuration;
using Tdn.Db.Configurers;

namespace Tdn.Db.Contexts;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<GameSystemsContext>
{
    public GameSystemsContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<GameSystemsContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new GameSystemsContext(optionsBuilder.Options, configurer);
    }
}
