using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configurers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class GameSystemsContext : BaseDbContext<GameSystemsContext>
{
    public GameSystemsContext(DbContextOptions<GameSystemsContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }

    public DbSet<SystemData> Systems => Set<SystemData>();
    public DbSet<SystemVersionData> SystemVersions => Set<SystemVersionData>();
    public DbSet<SystemAdminData> SystemAdmins => Set<SystemAdminData>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        Configurer.ConfigureModel(builder.Entity<SystemData>());
        Configurer.ConfigureModel(builder.Entity<SystemVersionData>());
        Configurer.ConfigureModel(builder.Entity<SystemAdminData>());
        base.OnModelCreating(builder);
    }
}
