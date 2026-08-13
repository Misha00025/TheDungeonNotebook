namespace Tdn.Models.DTOs;

public struct CharacterPutData
{
    public int? UserId { get; set; }
    public int? GroupId { get; set; }
    public int? CharacterId { get; set; }
    public bool? CanWrite { get; set; }
}
