namespace Tdn.Models.Commands;

public class CommandBatchItem
{
    public string? Type { get; set; }
    public int Status { get; set; }
    public bool Success { get; set; }
    public string? Message { get; set; }
    public List<string>? Errors { get; set; }
    public Dictionary<string, object?>? Data { get; set; }
}
