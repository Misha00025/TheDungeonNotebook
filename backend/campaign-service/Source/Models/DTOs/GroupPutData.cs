namespace Tdn.Models.DTOs;

public struct GroupPutData
{
    public int? UserId { get; set; }
    public int? GroupId { get; set; }
    public bool? IsAdmin { get; set; }
}
