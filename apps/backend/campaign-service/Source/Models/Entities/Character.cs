using Tdn.Db.Entities;

namespace Tdn.Models;

public class Character
{
    public int Id;
    public int GroupId;
    public int TemplateId;
    public int? OwnerId;
    public string Name = "";
    public string Description = "";
    public Dictionary<string, FieldMongoData> Fields = new();
    public List<AmountedItemMongoData> Items = new();
    public List<int>? Equipment;
}
