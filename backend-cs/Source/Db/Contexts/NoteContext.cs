using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

public class NoteContext : BaseDbContext<NoteContext>
{
    public NoteContext(DbContextOptions<NoteContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<CharacterData>());		
		Configurer.ConfigureModel(builder.Entity<NoteData>());		
		Configurer.ConfigureModel(builder.Entity<GroupData>());		
		base.OnModelCreating(builder);
	}
	
	public DbSet<NoteData> Notes => Set<NoteData>();
}