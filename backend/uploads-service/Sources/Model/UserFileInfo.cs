namespace Tdn.UploadService.Models;

public class UserFileInfo
{
    public string Url { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long Size { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserFilesResponse
{
    public List<UserFileInfo> Files { get; set; } = new();
}
