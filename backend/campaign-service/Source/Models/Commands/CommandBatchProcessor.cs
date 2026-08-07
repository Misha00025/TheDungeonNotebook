namespace Tdn.Models.Commands;

public class CommandBatchProcessor
{
    private readonly ICommandDispatcher _dispatcher;
    public CommandBatchProcessor(ICommandDispatcher dispatcher) => _dispatcher = dispatcher;

    public CommandBatchResult Process(int groupId, int characterId, List<CharacterCommandRequest> commands)
    {
        var results = new List<CommandBatchItem>();
        foreach (var cmd in commands)
        {
            var r = _dispatcher.Dispatch(groupId, characterId, cmd.Type, cmd.Payload);
            if (r == null)
            {
                results.Add(new CommandBatchItem { Type = cmd.Type, Status = 422, Success = false,
                    Message = $"Unknown command type '{cmd.Type}'" });
                return new CommandBatchResult { Status = 422, Results = results, FailedIndex = results.Count - 1 };
            }
            results.Add(new CommandBatchItem { Type = cmd.Type, Status = r.StatusCode, Success = r.Success,
                Message = r.Message, Errors = r.Errors, Data = r.Data });
            if (!r.Success)
                return new CommandBatchResult { Status = r.StatusCode, Results = results, FailedIndex = results.Count - 1 };
        }
        return new CommandBatchResult { Status = 200, Results = results, FailedIndex = null };
    }
}

public class CommandBatchResult
{
    public int Status { get; set; } = 200;
    public List<CommandBatchItem> Results { get; set; } = new();
    public int? FailedIndex { get; set; }
}
