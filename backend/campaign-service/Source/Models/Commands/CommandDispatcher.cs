namespace Tdn.Models.Commands;

 public class CommandDispatcher
{
    private readonly Dictionary<CharacterCommandType, ICommandHandler> _handlers;

    public CommandDispatcher(IEnumerable<ICommandHandler> handlers)
    {
        _handlers = handlers.ToDictionary(h => h.Handles);
    }

    public CommandResult? Dispatch(int groupId, int characterId, CharacterCommandRequest request)
        => _handlers.TryGetValue(request.Type, out var handler) ? handler.Execute(groupId, characterId, request) : null;
}
