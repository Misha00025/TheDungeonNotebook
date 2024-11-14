using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;


namespace TdnApi.Db.Contexts
{
	public class CharacterContext : BaseDbContext<CharacterContext>
	{
        public CharacterContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
        {
        }

        protected override void OnModelCreating(ModelBuilder builder)
		{
			base.OnModelCreating(builder);
			
			Configurer.ConfigureModel(builder.Entity<CharacterData>());
			Configurer.ConfigureModel(builder.Entity<UserCharacterData>());
			Configurer.ConfigureModel(builder.Entity<GroupData>());
		}
		
		public DbSet<CharacterData> Characters => Set<CharacterData>();
	}
}