namespace Tdn.Models;

public struct FilterPostData
{
    public string Key { get; set; } 
    public string Value { get; set; }
}

public struct CategoryPostData
{
    public string Title { get; set; }
    public List<FilterPostData> Filters { get; set; }
    public List<CategoryPostData> Children { get; set; }
}

public struct SchemaPostData 
{
    public List<CategoryPostData> Categories { get; set; }
}

public class Category
{
    public string Title = "";
    public List<(string key, string value)> Filters = new();
    public List<Category> Children = new();
}

public class Schema 
{
    public string Type = "";
    public List<Category> Categories = new();
}