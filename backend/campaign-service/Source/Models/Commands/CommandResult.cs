namespace Tdn.Models.Commands;

public class CommandResult
{
    public bool Success { get; set; } = true;
    public int StatusCode { get; set; } = 200;
    public Dictionary<string, object?>? Data { get; set; }
    public List<string>? Errors { get; set; }

    // Audit metadata
    public string? FieldKey { get; set; }
    public int OldValue { get; set; }
    public int NewValue { get; set; }
    public bool Changed { get; set; }
    public int Delta => NewValue - OldValue;

    public static CommandResult NotFound() => new() { Success = false, StatusCode = 404 };
    public static CommandResult Fail(List<string> errors) => new() { Success = false, StatusCode = 400, Errors = errors };
    public static CommandResult Ok(Dictionary<string, object?> data) => new() { Data = data };
}
