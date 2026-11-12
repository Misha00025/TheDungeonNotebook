using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class UserContext : BaseDbContext<UserContext>
{
    public UserContext(DbContextOptions<UserContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }
    
    protected override void OnModelCreating(ModelBuilder builder)
    {
        Configurer.ConfigureModel(builder.Entity<UserData>());
        Configurer.ConfigureModel(builder.Entity<LinkedServicesData>());
        base.OnModelCreating(builder);    
    }

    public DbSet<UserData> Users => Set<UserData>();
    public DbSet<LinkedServicesData> Links => Set<LinkedServicesData>();
}