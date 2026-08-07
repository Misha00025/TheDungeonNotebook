using System.Text.Json;

namespace Tdn.Models.Commands;

public interface ICommandDispatcher
{
    CommandResult? Dispatch(int groupId, int characterId, string type, JsonElement? payload);
}
