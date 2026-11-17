using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tdn.Campaigns.Access;

public static class SubjectReader
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public static Subject? Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        try
        {
            return JsonSerializer.Deserialize<Subject>(value, Options);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
