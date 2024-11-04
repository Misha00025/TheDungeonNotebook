using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

public class NoteContext : BaseDbContext
{
    public NoteContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<CharacterData>());		
		Configurer.ConfigureModel(builder.Entity<NoteData>());		
		base.OnModelCreating(builder);
	}
	
	public DbSet<NoteData> Notes => Set<NoteData>();
}