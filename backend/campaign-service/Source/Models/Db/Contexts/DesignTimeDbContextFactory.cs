using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Tdn.Configuration;
using Tdn.Db.Configuers;

namespace Tdn.Db.Contexts;

public class CampaignContextFactory : IDesignTimeDbContextFactory<CampaignContext>
{
    public CampaignContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<CampaignContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new CampaignContext(optionsBuilder.Options, configurer);
    }
}

public class GroupContextFactory : IDesignTimeDbContextFactory<GroupContext>
{
    public GroupContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<GroupContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new GroupContext(optionsBuilder.Options, configurer);
    }
}

public class EntityContextFactory : IDesignTimeDbContextFactory<EntityContext>
{
    public EntityContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<EntityContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new EntityContext(optionsBuilder.Options, configurer);
    }
}

public class ItemsContextFactory : IDesignTimeDbContextFactory<ItemsContext>
{
    public ItemsContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<EntityContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new ItemsContext(optionsBuilder.Options, configurer);
    }
}

public class SkillsContextFactory : IDesignTimeDbContextFactory<SkillsContext>
{
    public SkillsContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<EntityContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new SkillsContext(optionsBuilder.Options, configurer);
    }
}

public class PolicesContextFactory : IDesignTimeDbContextFactory<PolicesContext>
{
    public PolicesContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<PolicesContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new PolicesContext(optionsBuilder.Options, configurer);
    }
}
