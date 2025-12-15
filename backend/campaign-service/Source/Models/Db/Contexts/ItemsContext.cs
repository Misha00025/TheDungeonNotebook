using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class ItemsContext : EntityContext
{
    public ItemsContext(DbContextOptions<EntityContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }

    public DbSet<ItemData> Items => Set<ItemData>();
    public DbSet<CharacterItemData> CharacterItems => Set<CharacterItemData>();
}