namespace Tdn.Models.Commands;

public class CommandResult
{
    public bool Success { get; set; } = true;
    public int StatusCode { get; set; } = 200;
    public Dictionary<string, object?>? Data { get; set; }
    public List<string>? Errors { get; set; }
    public string? Message { get; set; }

    public static CommandResult NotFound() => new() { Success = false, StatusCode = 404 };
    public static CommandResult NoOp() => new() { Success = false, StatusCode = 400, Message = "Nothing to do" };
    public static CommandResult Conflict(string message) => new() { Success = false, StatusCode = 409, Message = message };
    public static CommandResult Fail(List<string> errors) => new() { Success = false, StatusCode = 400, Errors = errors };
    public static CommandResult Ok(Dictionary<string, object?> data) => new() { Data = data };
}
