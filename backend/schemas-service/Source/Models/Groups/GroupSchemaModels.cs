namespace Tdn.Models.Groups;

public struct FilterPostData
{
    public string Key { get; set; } 
    public string Value { get; set; }
}

public struct FilterPresetPostData
{
    public string Name;
    public List<FilterPostData> Filters;
}

public struct SchemaPostData 
{
    public List<string> GroupBy { get; set; }
    public List<FilterPresetPostData>? FilterPresets { get; set; }
}

public class FilterPreset
{
    public string Name = "";
    public List<(string key, string value)> Filters = new();
}

public class Schema 
{
    public string Type = "";
    public List<string> GroupingAttributes = new();
    public List<FilterPreset> FilterPresets = new();
}