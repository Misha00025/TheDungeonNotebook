using System.Text.Json;
using Tdn.Conversions;
using Xunit;

namespace Tdn.Tests.Source;

public class SettingsJsonHelperTests
{
    [Fact]
    public void RoundTrip_Preserves_HeterogeneousTypes()
    {
        string raw = """
        {
          "theme": "dark",
          "fontSize": 14,
          "ratio": 1.5,
          "enabled": true,
          "nothing": null,
          "tags": ["a", "b"],
          "nested": { "level": { "x": 1 } }
        }
        """;
        using var doc = JsonDocument.Parse(raw);
        var jsonMap = SettingsJsonHelper.ToJsonMap(SettingsJsonHelper.ToBsonMap(doc.RootElement));

        Assert.Equal("dark", jsonMap["theme"]);
        Assert.Equal(14, Convert.ToInt32(jsonMap["fontSize"]));
        Assert.Equal(1.5, Convert.ToDouble(jsonMap["ratio"]));
        Assert.Equal(true, jsonMap["enabled"]);
        Assert.Null(jsonMap["nothing"]);
        Assert.Equal(new List<object?> { "a", "b" }, jsonMap["tags"]);
        var nested = Assert.IsType<Dictionary<string, object?>>(jsonMap["nested"]);
        var level = Assert.IsType<Dictionary<string, object?>>(nested["level"]);
        Assert.Equal(1, Convert.ToInt32(level["x"]));
    }

    [Fact]
    public void ToBsonMap_Then_ToJsonMap_WorksWithEmptyObject()
    {
        using var doc = JsonDocument.Parse("{}");
        var jsonMap = SettingsJsonHelper.ToJsonMap(SettingsJsonHelper.ToBsonMap(doc.RootElement));
        Assert.Empty(jsonMap);
    }
}
