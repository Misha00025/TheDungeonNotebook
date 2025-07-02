using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class PolicesContext : BaseDbContext<PolicesContext>
{
    public PolicesContext(DbContextOptions<PolicesContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }
    
    protected override void OnModelCreating(ModelBuilder builder)
    {
        Configurer.ConfigureModel(builder.Entity<UserGroupData>());
        Configurer.ConfigureModel(builder.Entity<UserCharacterData>());
        base.OnModelCreating(builder);    
    }

    public DbSet<UserGroupData> Groups => Set<UserGroupData>();
    public DbSet<UserCharacterData> Characters => Set<UserCharacterData>();
}