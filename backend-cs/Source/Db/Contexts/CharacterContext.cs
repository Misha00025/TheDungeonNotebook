using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;


namespace TdnApi.Db.Contexts
{
	public class CharacterContext : DbContext
	{
		private IEntityBuildersConfigurer _configurer;
		public CharacterContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer): base(options)
		{
			_configurer = configurer;
		}
		
		protected override void OnModelCreating(ModelBuilder builder)
		{
			base.OnModelCreating(builder);
			
			_configurer.ConfigureModel(builder.Entity<CharacterData>());
			_configurer.ConfigureModel(builder.Entity<UserCharacterData>());
			_configurer.ConfigureModel(builder.Entity<GroupData>());
		}
	}
}