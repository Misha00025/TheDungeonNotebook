using System.Data;
using System.Data.Common;
using System.Collections;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using Tdn.Campaigns;
using Tdn.Campaigns.Configuration;
using Tdn.Campaigns.Persistence;

namespace CampaignService.Tests;

public sealed class LegacyCatalogCleanupTests
{
    private static readonly string[] OldSql = ["CatalogAdditionReceipts", "CharacterCatalogEntries", "CatalogEntries"];
    private static readonly string[] OldMongo = ["catalogAttributeDefinitions", "catalogContents", "characterCatalogContents", "catalogGroups"];
    private static readonly string[] NewSql = ["ItemDefinitions", "CharacterItems", "ItemAdditionReceipts", "SkillDefinitions", "CharacterSkills", "SkillAdditionReceipts"];
    private static readonly string[] NewMongo = ["itemAttributeDefinitions", "itemContents", "characterItemContents", "itemGroups", "skillAttributeDefinitions", "skillContents", "characterSkillContents", "skillGroups"];

    [Fact]
    public async Task ProductionCleanupRemovesOnlyLegacyNamespacesAndCanRepeatWithoutTouchingNewData()
    {
        var sql = new FakeDbConnection(OldSql.Concat(NewSql).Concat(["Campaigns", "CampaignTemplates", "CharacterMetadata", "FormulaMetadata", "ViewMetadata"]));
        var mongo = FakeMongoDatabase.Create(OldMongo.Concat(NewMongo).Concat(["campaignTemplates", "characterSheets", "formulaContents", "viewContents"]));
        await using var context = CreateContext(sql);
        var cleanup = new LegacyCatalogCleanup(context, mongo.Database, NullLogger<LegacyCatalogCleanup>.Instance);
        await cleanup.PurgeAsync(default);
        Assert.Equal(OldSql, sql.DeletedTables);
        Assert.Equal(OldMongo, mongo.DeletedCollections);
        Assert.All(NewSql.Concat(["Campaigns", "CampaignTemplates", "CharacterMetadata", "FormulaMetadata", "ViewMetadata"]), table => Assert.Equal(1, sql.Rows[table]));
        Assert.All(NewMongo.Concat(["campaignTemplates", "characterSheets", "formulaContents", "viewContents"]), collection => Assert.Equal(1, mongo.Rows[collection]));

        sql.AddRows(NewSql);
        mongo.AddRows(NewMongo);
        var preservedSql = sql.CaptureRows();
        var preservedMongo = mongo.CaptureRows();
        await cleanup.PurgeAsync(default);
        Assert.Equal(2, sql.CommitCount);
        Assert.Equal(preservedSql, sql.CaptureRows());
        Assert.Equal(preservedMongo, mongo.CaptureRows());
        Assert.Equal(OldSql.Concat(OldSql), sql.DeletedTables);
        Assert.Equal(OldMongo.Concat(OldMongo), mongo.DeletedCollections);
    }

    [Fact]
    public async Task MissingLegacyTablesAndCollectionsAreHarmlessAndNewDataSurvives()
    {
        var sql = new FakeDbConnection(NewSql);
        var mongo = FakeMongoDatabase.Create(NewMongo);
        await using var context = CreateContext(sql);
        await new LegacyCatalogCleanup(context, mongo.Database, NullLogger<LegacyCatalogCleanup>.Instance).PurgeAsync(default);
        Assert.Empty(sql.DeletedTables);
        Assert.Equal(OldMongo, mongo.DeletedCollections);
        Assert.All(NewSql, table => Assert.Equal(1, sql.Rows[table]));
        Assert.All(NewMongo, collection => Assert.Equal(1, mongo.Rows[collection]));
    }

    [Fact]
    public async Task HostedServiceAwaitsCleanup()
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var fake = new GatedCleanup(completion.Task);
        using var services = new ServiceCollection().AddScoped<ILegacyCatalogCleanup>(_ => fake).BuildServiceProvider();
        var hosted = new LegacyCatalogCleanupService(services.GetRequiredService<IServiceScopeFactory>(), NullLogger<LegacyCatalogCleanupService>.Instance);
        var startup = hosted.StartAsync(default);
        Assert.False(startup.IsCompleted);
        completion.SetResult();
        await startup;
        await hosted.StopAsync(default);
        Assert.Equal(1, fake.Calls);
    }

    [Fact]
    public async Task CleanupHostedServiceIsRegisteredWithoutMigrationsAndFollowsMigrationRegistration()
    {
        const string sql = "Server=127.0.0.1;Database=unit_unused;User ID=unit_placeholder;";
        const string mongo = "mongodb://127.0.0.1:27017";
        await using var withoutMigrations = CampaignApplication.Build(["--MYSQL_CONNECTION_STRING", sql, "--MONGO_CONNECTION_STRING", mongo,
            "--MONGO_DATABASE", "unit_content", "--Database:ApplyMigrations", "false"]);
        var noMigrationServices = withoutMigrations.Services.GetServices<IHostedService>().ToArray();
        Assert.DoesNotContain(noMigrationServices, service => service is DatabaseMigrationService);
        Assert.Single(noMigrationServices.OfType<LegacyCatalogCleanupService>());

        await using var withMigrations = CampaignApplication.Build(["--MYSQL_CONNECTION_STRING", sql, "--MONGO_CONNECTION_STRING", mongo,
            "--MONGO_DATABASE", "unit_content", "--Database:ApplyMigrations", "true"]);
        var migrationServices = withMigrations.Services.GetServices<IHostedService>().ToArray();
        Assert.True(Array.FindIndex(migrationServices, service => service is DatabaseMigrationService) < Array.FindIndex(migrationServices, service => service is LegacyCatalogCleanupService));
    }

    private static CampaignDbContext CreateContext(DbConnection connection)
    {
        var options = new DbContextOptionsBuilder<CampaignDbContext>()
            .UseMySql(connection, new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;
        return new CampaignDbContext(options);
    }

    private sealed class GatedCleanup(Task wait) : ILegacyCatalogCleanup
    {
        public int Calls { get; private set; }
        public async Task PurgeAsync(CancellationToken cancellationToken) { Calls++; await wait.WaitAsync(cancellationToken); }
    }

    private sealed class FakeDbConnection(IEnumerable<string> tables) : DbConnection
    {
        private readonly HashSet<string> existing = tables.ToHashSet(StringComparer.Ordinal);
        public Dictionary<string, int> Rows { get; } = tables.ToDictionary(x => x, _ => 1, StringComparer.Ordinal);
        public List<string> DeletedTables { get; } = [];
        public int CommitCount { get; private set; }
        [AllowNull]
        public override string ConnectionString { get; set; } = string.Empty;
        public override string Database => "unit_catalog_cleanup";
        public override string DataSource => "in-memory";
        public override string ServerVersion => "8.0.36";
        private ConnectionState state = ConnectionState.Closed;
        public override ConnectionState State => state;
        public override void ChangeDatabase(string databaseName) { }
        public override void Close() => state = ConnectionState.Closed;
        public override void Open() => state = ConnectionState.Open;
        public override Task OpenAsync(CancellationToken cancellationToken) { cancellationToken.ThrowIfCancellationRequested(); Open(); return Task.CompletedTask; }
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => new FakeTransaction(this, isolationLevel);
        protected override DbCommand CreateDbCommand() => new FakeCommand(this);
        public void AddRows(IEnumerable<string> names) { foreach (var name in names) { existing.Add(name); Rows[name] = 1; } }
        public Dictionary<string, int> CaptureRows() => new(Rows, StringComparer.Ordinal);
        private void Restore(Dictionary<string, int> state) { Rows.Clear(); foreach (var pair in state) Rows[pair.Key] = pair.Value; }

        private sealed class FakeTransaction(FakeDbConnection connection, IsolationLevel isolation) : DbTransaction
        {
            private readonly Dictionary<string, int> original = connection.CaptureRows();
            private bool completed;
            public override IsolationLevel IsolationLevel => isolation;
            protected override DbConnection? DbConnection => connection;
            public override void Commit() { connection.CommitCount++; completed = true; }
            public override Task CommitAsync(CancellationToken cancellationToken = default) { cancellationToken.ThrowIfCancellationRequested(); Commit(); return Task.CompletedTask; }
            public override void Rollback() { connection.Restore(original); completed = true; }
            public override Task RollbackAsync(CancellationToken cancellationToken = default) { Rollback(); return Task.CompletedTask; }
            protected override void Dispose(bool disposing) { if (disposing && !completed) Rollback(); base.Dispose(disposing); }
        }

        private sealed class FakeCommand(FakeDbConnection connection) : DbCommand
        {
            private readonly FakeParameterCollection parameters = new();
            private DbTransaction? transaction;
            [AllowNull]
            public override string CommandText { get; set; } = string.Empty;
            public override int CommandTimeout { get; set; }
            public override CommandType CommandType { get; set; } = CommandType.Text;
            public override bool DesignTimeVisible { get; set; }
            public override UpdateRowSource UpdatedRowSource { get; set; }
            protected override DbConnection? DbConnection { get => connection; set => throw new NotSupportedException(); }
            protected override DbParameterCollection DbParameterCollection => parameters;
            protected override DbTransaction? DbTransaction { get => transaction; set => transaction = value; }
            public override void Cancel() { }
            public override int ExecuteNonQuery()
            {
                Assert.NotNull(transaction);
                var table = CommandText.Replace("DELETE FROM ", "", StringComparison.Ordinal).Trim('`', ' ');
                if (connection.Rows.ContainsKey(table)) connection.Rows[table] = 0;
                connection.DeletedTables.Add(table);
                return 1;
            }
            public override object ExecuteScalar()
            {
                Assert.NotNull(transaction);
                Assert.Equal("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = @tableName", CommandText);
                Assert.Equal("@tableName", parameters[0] is DbParameter parameter ? parameter.ParameterName : null);
                Assert.Equal("unit_catalog_cleanup", connection.Database);
                var table = Convert.ToString(((DbParameter)parameters[0]!).Value)!;
                return connection.existing.Contains(table) ? 1L : 0L;
            }
            public override Task<object?> ExecuteScalarAsync(CancellationToken cancellationToken)
            {
                cancellationToken.ThrowIfCancellationRequested();
                return Task.FromResult<object?>(ExecuteScalar());
            }
            public override Task<int> ExecuteNonQueryAsync(CancellationToken cancellationToken)
            {
                cancellationToken.ThrowIfCancellationRequested();
                return Task.FromResult(ExecuteNonQuery());
            }
            protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => throw new NotSupportedException();
            public override void Prepare() { }
            protected override DbParameter CreateDbParameter() => new FakeParameter();
        }

        private sealed class FakeParameter : DbParameter
        {
            public override DbType DbType { get; set; }
            public override ParameterDirection Direction { get; set; } = ParameterDirection.Input;
            public override bool IsNullable { get; set; }
            [AllowNull]
            public override string ParameterName { get; set; } = string.Empty;
            [AllowNull]
            public override string SourceColumn { get; set; } = string.Empty;
            public override object? Value { get; set; }
            public override bool SourceColumnNullMapping { get; set; }
            public override int Size { get; set; }
            public override DataRowVersion SourceVersion { get; set; } = DataRowVersion.Current;
            public override void ResetDbType() { }
        }

        private sealed class FakeParameterCollection : DbParameterCollection
        {
            private readonly List<DbParameter> items = [];
            public override int Count => items.Count;
            public override bool IsFixedSize => false;
            public override bool IsReadOnly => false;
            public override bool IsSynchronized => false;
            public override object SyncRoot => ((ICollection)items).SyncRoot;
            public override int Add(object value) { items.Add((DbParameter)value); return items.Count - 1; }
            public override void AddRange(Array values) { foreach (var value in values) Add(value!); }
            public override void Clear() => items.Clear();
            public override bool Contains(object value) => items.Contains((DbParameter)value);
            public override bool Contains(string value) => items.Any(x => x.ParameterName == value);
            public override void CopyTo(Array array, int index) => ((ICollection)items).CopyTo(array, index);
            public override IEnumerator GetEnumerator() => items.GetEnumerator();
            protected override DbParameter GetParameter(int index) => items[index];
            protected override DbParameter GetParameter(string parameterName) => items.Single(x => x.ParameterName == parameterName);
            public override int IndexOf(object value) => items.IndexOf((DbParameter)value);
            public override int IndexOf(string parameterName) => items.FindIndex(x => x.ParameterName == parameterName);
            public override void Insert(int index, object value) => items.Insert(index, (DbParameter)value);
            public override void Remove(object value) => items.Remove((DbParameter)value);
            public override void RemoveAt(int index) => items.RemoveAt(index);
            public override void RemoveAt(string parameterName) => items.RemoveAt(IndexOf(parameterName));
            protected override void SetParameter(int index, DbParameter value) => items[index] = value;
            protected override void SetParameter(string parameterName, DbParameter value) { var index = IndexOf(parameterName); if (index < 0) items.Add(value); else items[index] = value; }
        }
    }

    public sealed class FakeMongoDatabase
    {
        public IMongoDatabase Database { get; }
        public Dictionary<string, int> Rows { get; }
        public List<string> DeletedCollections { get; } = [];

        private FakeMongoDatabase(IEnumerable<string> names)
        {
            Rows = names.ToDictionary(x => x, _ => 1, StringComparer.Ordinal);
            var proxy = DispatchProxy.Create<IMongoDatabase, DatabaseProxy>();
            ((DatabaseProxy)(object)proxy).Owner = this;
            Database = proxy;
        }

        public static FakeMongoDatabase Create(IEnumerable<string> names) => new(names);
        public void AddRows(IEnumerable<string> names) { foreach (var name in names) Rows[name] = 1; }
        public Dictionary<string, int> CaptureRows() => new(Rows, StringComparer.Ordinal);

        public class DatabaseProxy : DispatchProxy
        {
            public FakeMongoDatabase Owner { get; set; } = null!;
            protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            {
                if (targetMethod?.Name != "GetCollection") throw new NotSupportedException(targetMethod?.Name);
                var name = (string)args![0]!;
                var documentType = targetMethod.GetGenericArguments()[0];
                var proxyMethod = typeof(FakeMongoDatabase).GetMethod(nameof(CreateCollection), BindingFlags.Instance | BindingFlags.NonPublic)!.MakeGenericMethod(documentType);
                return proxyMethod.Invoke(Owner, [name]);
            }
        }

        private object CreateCollection<TDocument>(string name)
        {
            var proxy = DispatchProxy.Create<IMongoCollection<TDocument>, CollectionProxy<TDocument>>();
            ((CollectionProxy<TDocument>)(object)proxy).Owner = this;
            ((CollectionProxy<TDocument>)(object)proxy).Name = name;
            return proxy;
        }

        public class CollectionProxy<TDocument> : DispatchProxy
        {
            public FakeMongoDatabase Owner { get; set; } = null!;
            public string Name { get; set; } = string.Empty;
            protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            {
                if (targetMethod?.Name != "DeleteManyAsync") throw new NotSupportedException(targetMethod?.Name);
                var cancellation = args?.OfType<CancellationToken>().FirstOrDefault() ?? default;
                cancellation.ThrowIfCancellationRequested();
                var filter = Assert.IsAssignableFrom<FilterDefinition<TDocument>>(args?[0]);
                var registry = MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry;
                var serializer = registry.GetSerializer<TDocument>();
                var renderArgs = new RenderArgs<TDocument>(serializer, registry, new PathRenderArgs(string.Empty, false), false, false, false, null!);
                Assert.Equal(new BsonDocument(), filter.Render(renderArgs));
                Owner.DeletedCollections.Add(Name);
                if (Owner.Rows.ContainsKey(Name)) Owner.Rows[Name] = 0;
                return Task.FromResult<DeleteResult>(new DeleteResult.Acknowledged(1));
            }
        }
    }
}
