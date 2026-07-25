using Tdn.Configuration;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser();

// General
builder.Services.AddMvc();
builder.Services.AddHttpContextAccessor();
builder.Services.AddLogging(e => e.AddConsole());

builder.Services.AddSingleton<IEntityBuildersConfigurer, EntityBuildersConfigurer>();
builder.Services.AddDbContext<UserContext>(config.ConfigDbConnections);

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();
var app = builder.Build();

// Auto-create tables with retry (wait for MySQL to be ready)
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<UserContext>();
    for (int i = 0; i < 10; i++)
    {
        try
        {
            ctx.Database.EnsureCreated();
            Console.WriteLine("[Init] Tables created/verified successfully");
            break;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Init] MySQL not ready (attempt {i+1}/10): {ex.Message}");
            if (i == 9) throw;
            Thread.Sleep(3000);
        }
    }
}

app.UseHttpMetrics();
app.MapMetrics();
app.MapControllers();
app.Run();
