using System.Text.Json;

namespace Tdn.Models.Commands;

public interface ICommandDispatcher
{
    CommandResult? Dispatch(string type, JsonElement? payload, CommandContext ctx);
}
