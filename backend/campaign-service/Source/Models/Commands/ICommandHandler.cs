using System.Text.Json;

namespace Tdn.Models.Commands;

public interface ICommandHandler
{
    string Handles { get; }
    CommandResult Execute(int groupId, int characterId, JsonElement payload);
}

public interface ICommandHandler<T> : ICommandHandler where T : ICharacterCommand
{
    T Parse(JsonElement payload);
    CommandResult Execute(int groupId, int characterId, T command);
}

public abstract class CommandHandler<T> : ICommandHandler<T> where T : ICharacterCommand
{
    public abstract string Handles { get; }
    public abstract T Parse(JsonElement payload);
    public abstract CommandResult Execute(int groupId, int characterId, T command);

    public CommandResult Execute(int groupId, int characterId, JsonElement payload)
        => Execute(groupId, characterId, Parse(payload));
}
