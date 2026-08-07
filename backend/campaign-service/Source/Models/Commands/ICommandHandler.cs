using System.Text.Json;

namespace Tdn.Models.Commands;

public interface ICommandHandler
{
    string Handles { get; }
    CommandResult Execute(JsonElement payload, CommandContext ctx);
}

public interface ICommandHandler<T> : ICommandHandler where T : ICharacterCommand
{
    T Parse(JsonElement payload);
    CommandResult Execute(T command, CommandContext ctx);
}

public abstract class CommandHandler<T> : ICommandHandler<T> where T : ICharacterCommand
{
    public abstract string Handles { get; }
    public abstract T Parse(JsonElement payload);
    public abstract CommandResult Execute(T command, CommandContext ctx);
    public CommandResult Execute(JsonElement payload, CommandContext ctx) => Execute(Parse(payload), ctx);
}
