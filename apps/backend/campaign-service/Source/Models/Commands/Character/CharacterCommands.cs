namespace Tdn.Models.Commands;

public interface ICharacterCommand
{
}

public sealed record AddFieldCommand(string? Key, FieldCommandData? Field) : ICharacterCommand;
public sealed record UpdateFieldCommand(string? Key, FieldCommandData? Field) : ICharacterCommand;
public sealed record DeleteFieldCommand(string? Key) : ICharacterCommand;
public sealed record EquipItemCommand(int ItemId) : ICharacterCommand;
public sealed record UnequipItemCommand(int ItemId) : ICharacterCommand;
