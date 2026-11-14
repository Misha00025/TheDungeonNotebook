using System.Diagnostics;
using System.Text;

namespace bff_web.Tests.Delivery;

public sealed class EntrypointTests
{
    [LinuxFact]
    public async Task SeedsMissingRuntimeConfigAndExecutesDotnetWithAbsoluteAppPathAndArguments()
    {
        using var fixture = EntrypointFixture.Create();
        var defaultBytes = Encoding.UTF8.GetBytes("{\"source\":\"image-default\"}\n");
        await File.WriteAllBytesAsync(fixture.DefaultConfigPath, defaultBytes);

        var result = await fixture.RunAsync("--urls", "http://localhost:5080", "argument with spaces");

        Assert.Equal(0, result.ExitCode);
        Assert.Equal(defaultBytes, await File.ReadAllBytesAsync(fixture.RuntimeConfigPath));
        Assert.Equal(
        [
            Path.Combine(fixture.AppDirectory, "bff-web.dll"),
            "--urls",
            "http://localhost:5080",
            "argument with spaces"
        ], await File.ReadAllLinesAsync(fixture.ArgumentsPath));
        Assert.True(File.Exists(fixture.DotnetCalledPath));
        Assert.NotEqual(fixture.AppDirectory, fixture.WorkingDirectory);
    }

    [LinuxFact]
    public async Task PreservesEditedRuntimeConfigAcrossRestarts()
    {
        using var fixture = EntrypointFixture.Create();
        var defaultBytes = Encoding.UTF8.GetBytes("{\"source\":\"new-image-default\"}\n");
        var editedBytes = Encoding.UTF8.GetBytes("{\"source\":\"host-edited\",\"setting\":7}\n");
        await File.WriteAllBytesAsync(fixture.DefaultConfigPath, defaultBytes);
        Directory.CreateDirectory(Path.GetDirectoryName(fixture.RuntimeConfigPath)!);
        await File.WriteAllBytesAsync(fixture.RuntimeConfigPath, editedBytes);

        var firstStart = await fixture.RunAsync();
        var secondStart = await fixture.RunAsync();

        Assert.Equal(0, firstStart.ExitCode);
        Assert.Equal(0, secondStart.ExitCode);
        Assert.Equal(editedBytes, await File.ReadAllBytesAsync(fixture.RuntimeConfigPath));
    }

    [LinuxFact]
    public async Task MissingDefaultAndRuntimeConfigStopsBeforeDotnet()
    {
        using var fixture = EntrypointFixture.Create();

        var result = await fixture.RunAsync();

        Assert.NotEqual(0, result.ExitCode);
        Assert.False(File.Exists(fixture.DotnetCalledPath));
        Assert.False(File.Exists(fixture.RuntimeConfigPath));
    }

    [LinuxFact]
    public async Task ExistingRuntimeConfigStartsWithoutDefaultConfig()
    {
        using var fixture = EntrypointFixture.Create();
        var editedBytes = Encoding.UTF8.GetBytes("{\"source\":\"existing-host-config\"}\n");
        Directory.CreateDirectory(Path.GetDirectoryName(fixture.RuntimeConfigPath)!);
        await File.WriteAllBytesAsync(fixture.RuntimeConfigPath, editedBytes);

        var result = await fixture.RunAsync();

        Assert.Equal(0, result.ExitCode);
        Assert.True(File.Exists(fixture.DotnetCalledPath));
        Assert.Equal(editedBytes, await File.ReadAllBytesAsync(fixture.RuntimeConfigPath));
    }

    private sealed class EntrypointFixture : IDisposable
    {
        private const string FakeDotnetScript = "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$ENTRYPOINT_TEST_ARGUMENTS\"\n: > \"$ENTRYPOINT_TEST_CALLED\"\n";

        private EntrypointFixture(string rootDirectory)
        {
            RootDirectory = rootDirectory;
            AppDirectory = Path.Combine(rootDirectory, "app");
            WorkingDirectory = Path.Combine(rootDirectory, "unrelated-working-directory");
            DefaultConfigPath = Path.Combine(AppDirectory, "default-config", "appsettings.json");
            RuntimeConfigPath = Path.Combine(AppDirectory, "config", "appsettings.json");
            DotnetPath = Path.Combine(rootDirectory, "bin", "dotnet");
            ArgumentsPath = Path.Combine(rootDirectory, "captured-arguments");
            DotnetCalledPath = Path.Combine(rootDirectory, "dotnet-called");
        }

        private string RootDirectory { get; }
        public string AppDirectory { get; }
        public string WorkingDirectory { get; }
        public string DefaultConfigPath { get; }
        public string RuntimeConfigPath { get; }
        public string DotnetPath { get; }
        public string ArgumentsPath { get; }
        public string DotnetCalledPath { get; }

        public static EntrypointFixture Create()
        {
            if (!OperatingSystem.IsLinux())
                throw new PlatformNotSupportedException();

            var fixture = new EntrypointFixture(CreateTemporaryDirectory());
            try
            {
                Directory.CreateDirectory(fixture.AppDirectory);
                Directory.CreateDirectory(Path.GetDirectoryName(fixture.DefaultConfigPath)!);
                Directory.CreateDirectory(fixture.WorkingDirectory);
                Directory.CreateDirectory(Path.GetDirectoryName(fixture.DotnetPath)!);

                var sourceScript = Path.Combine(AppContext.BaseDirectory, "Fixtures", "entrypoint.sh");
                File.Copy(sourceScript, Path.Combine(fixture.AppDirectory, "entrypoint.sh"));
                File.WriteAllText(fixture.DotnetPath, FakeDotnetScript, new UTF8Encoding(false));
                File.SetUnixFileMode(fixture.DotnetPath, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
                return fixture;
            }
            catch
            {
                fixture.Dispose();
                throw;
            }
        }

        public async Task<ProcessResult> RunAsync(params string[] arguments)
        {
            var startInfo = new ProcessStartInfo("/bin/sh")
            {
                WorkingDirectory = WorkingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };
            startInfo.ArgumentList.Add(Path.Combine(AppDirectory, "entrypoint.sh"));
            foreach (var argument in arguments)
                startInfo.ArgumentList.Add(argument);

            var inheritedPath = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
            startInfo.Environment["PATH"] = Path.GetDirectoryName(DotnetPath) + Path.PathSeparator + inheritedPath;
            startInfo.Environment["ENTRYPOINT_TEST_ARGUMENTS"] = ArgumentsPath;
            startInfo.Environment["ENTRYPOINT_TEST_CALLED"] = DotnetCalledPath;

            using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Could not start /bin/sh.");
            var standardOutput = process.StandardOutput.ReadToEndAsync();
            var standardError = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            return new ProcessResult(process.ExitCode, await standardOutput, await standardError);
        }

        public void Dispose()
        {
            if (Directory.Exists(RootDirectory))
                Directory.Delete(RootDirectory, recursive: true);
        }

        private static string CreateTemporaryDirectory()
        {
            var preferredBase = "/tmp/opencode";
            if (Directory.Exists(preferredBase))
            {
                try
                {
                    return CreateChildDirectory(preferredBase);
                }
                catch (UnauthorizedAccessException)
                {
                }
                catch (IOException)
                {
                }
            }

            return CreateChildDirectory(Path.GetTempPath());
        }

        private static string CreateChildDirectory(string parent)
        {
            var path = Path.Combine(parent, $"bff-entrypoint-{Guid.NewGuid():N}");
            Directory.CreateDirectory(path);
            return path;
        }
    }

    private sealed record ProcessResult(int ExitCode, string StandardOutput, string StandardError);

}

public sealed class LinuxFactAttribute : FactAttribute
{
    public LinuxFactAttribute()
    {
        if (!OperatingSystem.IsLinux())
            Skip = "Entrypoint bootstrap tests require Linux /bin/sh.";
    }
}
