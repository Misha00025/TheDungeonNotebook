using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class LoginContext : BaseDbContext<LoginContext>
{
    public LoginContext(DbContextOptions<LoginContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }
    
    protected override void OnModelCreating(ModelBuilder builder)
    {
        Configurer.ConfigureModel(builder.Entity<UserData>());
        base.OnModelCreating(builder);    
    }

    public DbSet<UserData> Users => Set<UserData>();
}