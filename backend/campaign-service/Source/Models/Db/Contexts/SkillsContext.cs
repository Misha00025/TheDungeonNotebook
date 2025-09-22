using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class SkillsContext : EntityContext
{
    public SkillsContext(DbContextOptions<EntityContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }

    public DbSet<SkillData> Skills => Set<SkillData>();
    public DbSet<CharacterSkillData> CharacterSkills => Set<CharacterSkillData>();
}