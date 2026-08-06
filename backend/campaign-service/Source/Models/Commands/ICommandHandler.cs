namespace Tdn.Models.Commands;

public interface ICommandHandler
{
    CharacterCommandType Handles { get; }
    CommandResult Execute(int groupId, int characterId, CharacterCommandRequest request);
}
