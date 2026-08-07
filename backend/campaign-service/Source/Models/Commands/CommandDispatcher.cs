using System.Text.Json;

namespace Tdn.Models.Commands;

public class CommandDispatcher : ICommandDispatcher
{
    private readonly Dictionary<string, ICommandHandler> _handlers;

    public CommandDispatcher(IEnumerable<ICommandHandler> handlers)
    {
        _handlers = handlers.ToDictionary(h => h.Handles);
    }

    public CommandResult? Dispatch(int groupId, int characterId, string type, JsonElement? payload)
    {
        if (!_handlers.TryGetValue(type, out var handler))
            return null;
        return handler.Execute(groupId, characterId, payload ?? default);
    }
}
