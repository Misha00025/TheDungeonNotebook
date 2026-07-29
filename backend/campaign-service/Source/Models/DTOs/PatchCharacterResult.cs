namespace Tdn.Models.DTOs;

public class PatchCharacterResult
{
    public bool Success { get; init; }
    public Dictionary<string, object?>? Data { get; init; }
    public List<string>? Errors { get; init; }
    public int? StatusCode { get; init; }
    public Dictionary<string, int>? OldFieldValues { get; init; }
}
