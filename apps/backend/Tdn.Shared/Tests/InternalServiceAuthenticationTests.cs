using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tdn.Shared.Security;
using Xunit;

namespace Tdn.Shared.Tests;

public sealed class InternalServiceAuthenticationTests
{
    private const string Key = "synthetic-test-key-with-at-least-32-bytes";

    [Theory]
    [InlineData(null)]
    [InlineData("wrong-test-key-which-is-long-enough-123")]
    public async Task RejectsMissingOrWrongKey(string? supplied)
    {
        var context = Context();
        context.Request.Headers["X-Subject"] = "forged-subject";
        if (supplied is not null) context.Request.Headers["X-Internal-Service-Key"] = supplied;
        var called = false;
        await Middleware(() => called = true).InvokeAsync(context);
        Assert.False(called);
        Assert.Equal(401, context.Response.StatusCode);
        Assert.DoesNotContain(Key, await Response(context));
    }

    [Fact]
    public async Task RejectsMultipleValues()
    {
        var context = Context();
        context.Request.Headers.Append("X-Internal-Service-Key", Key);
        context.Request.Headers.Append("X-Internal-Service-Key", Key);
        var called = false;
        await Middleware(() => called = true).InvokeAsync(context);
        Assert.False(called);
    }

    [Fact]
    public async Task AcceptsValidKey()
    {
        var context = Context();
        context.Request.Headers["X-Internal-Service-Key"] = Key;
        var called = false;
        await Middleware(() => called = true).InvokeAsync(context);
        Assert.True(called);
    }

    [Theory]
    [InlineData("/metrics", true)]
    [InlineData("/health/live", true)]
    [InlineData("/health/ready", true)]
    [InlineData("/metrics/anything", false)]
    [InlineData("/health/live/", false)]
    public async Task BypassesOnlyExactPublicPaths(string path, bool expected)
    {
        var context = Context(path);
        var called = false;
        await Middleware(() => called = true).InvokeAsync(context);
        Assert.Equal(expected, called);
    }

    [Fact]
    public void RejectsConflictingConfiguration()
    {
        Assert.Throws<InvalidOperationException>(() => Configure(("INTERNAL_SERVICE_KEY", Key), ("INTERNAL_SERVICE_KEY_FILE", "/not-used")));
    }

    [Fact]
    public void RejectsMissingConfiguration()
    {
        Assert.Throws<InvalidOperationException>(() => Configure());
    }

    [Theory]
    [InlineData("short")]
    public void RejectsShortConfiguration(string key)
    {
        Assert.Throws<InvalidOperationException>(() => Configure(("INTERNAL_SERVICE_KEY", key)));
    }

    [Fact]
    public void ReadsFileSecretAndTrimsOnlyLineEndings()
    {
        var directory = Directory.CreateTempSubdirectory();
        try
        {
            var path = Path.Combine(directory.FullName, "secret");
            File.WriteAllText(path, Key + "\r\n");
            Assert.NotNull(Configure(("INTERNAL_SERVICE_KEY_FILE", path)));
        }
        finally
        {
            directory.Delete(true);
        }
    }

    private static InternalServiceAuthenticationMiddleware Middleware(Action next) => new(_ => { next(); return Task.CompletedTask; }, System.Text.Encoding.UTF8.GetBytes(Key));
    private static DefaultHttpContext Context(string path = "/private") => new() { Request = { Path = path }, Response = { Body = new MemoryStream() } };
    private static async Task<string> Response(HttpContext context) { context.Response.Body.Position = 0; using var reader = new StreamReader(context.Response.Body); return await reader.ReadToEndAsync(); }

    private static IApplicationBuilder Configure(params (string Key, string Value)[] values)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(x => x.Key, x => (string?)x.Value)).Build();
        return new ApplicationBuilder(new ServiceCollection().BuildServiceProvider()).UseInternalServiceAuthentication(configuration);
    }
}
