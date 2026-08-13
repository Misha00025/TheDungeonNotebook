using System.Globalization;
using System.Runtime.CompilerServices;

namespace Tdn.Tests.Source;

internal static class TestSetup
{
    [ModuleInitializer]
    public static void Initialize()
    {
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;
    }
}
