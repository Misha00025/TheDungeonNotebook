using System.Text.Json;

namespace Tdn.Models.Commands;

public class CommandDispatcher : ICommandDispatcher
{
    private readonly Dictionary<string, ICommandHandler> _handlers;

    public CommandDispatcher(IEnumerable<ICommandHandler> handlers)
    {
        _handlers = handlers.ToDictionary(h => h.Handles);
    }

    public CommandResult? Dispatch(string type, JsonElement? payload, CommandContext ctx)
    {
        if (!_handlers.TryGetValue(type, out var handler))
            return null;
        return handler.Execute(payload ?? default, ctx);
    }
}
