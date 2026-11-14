namespace Tdn.Bff;

public static class Program
{
    public static Task Main(string[] args) => BffApplication.Build(args).RunAsync();
}
