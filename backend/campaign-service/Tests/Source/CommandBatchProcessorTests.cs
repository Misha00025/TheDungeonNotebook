using System.Text.Json;
using Tdn.Models.Commands;

namespace Tdn.Tests.Source;

public class CommandBatchProcessorTests
{
    [Fact]
    public void Process_AllOk_Returns200_WithAllResults()
    {
        var dispatcherMock = new Mock<ICommandDispatcher>();
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "updatefield", It.IsAny<JsonElement?>()))
            .Returns(CommandResult.Ok(new Dictionary<string, object?> { { "field", "agility" } }));
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "adddata", It.IsAny<JsonElement?>()))
            .Returns(CommandResult.Ok(new Dictionary<string, object?> { { "data", "added" } }));

        var processor = new CommandBatchProcessor(dispatcherMock.Object);

        var commands = new List<CharacterCommandRequest>
        {
            new() { Type = "updatefield" },
            new() { Type = "adddata" }
        };

        var result = processor.Process(1, 1, commands);

        Assert.Equal(200, result.Status);
        Assert.Equal(2, result.Results.Count);
        Assert.True(result.Results[0].Success);
        Assert.True(result.Results[1].Success);
        Assert.Null(result.FailedIndex);

        dispatcherMock.Verify(d => d.Dispatch(1, 1, "updatefield", It.IsAny<JsonElement?>()), Times.Once);
        dispatcherMock.Verify(d => d.Dispatch(1, 1, "adddata", It.IsAny<JsonElement?>()), Times.Once);
    }

    [Fact]
    public void Process_StopsOnFirstFailure_ReturnsFailingStatus()
    {
        var dispatcherMock = new Mock<ICommandDispatcher>();
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "updatefield", It.IsAny<JsonElement?>()))
            .Returns(CommandResult.Ok(new Dictionary<string, object?> { { "field", "strength" } }));
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "adddata", It.IsAny<JsonElement?>()))
            .Returns(CommandResult.NoOp());
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "deletefield", It.IsAny<JsonElement?>()))
            .Returns(CommandResult.Ok(new Dictionary<string, object?> { { "removed", true } }));

        var processor = new CommandBatchProcessor(dispatcherMock.Object);

        var commands = new List<CharacterCommandRequest>
        {
            new() { Type = "updatefield" },
            new() { Type = "adddata" },
            new() { Type = "deletefield" }
        };

        var result = processor.Process(1, 1, commands);

        Assert.Equal(400, result.Status);
        Assert.Equal(2, result.Results.Count);
        Assert.True(result.Results[0].Success);
        Assert.False(result.Results[1].Success);
        Assert.Equal(1, result.FailedIndex);
        Assert.Equal("Nothing to do", result.Results[1].Message);

        dispatcherMock.Verify(d => d.Dispatch(1, 1, "updatefield", It.IsAny<JsonElement?>()), Times.Once);
        dispatcherMock.Verify(d => d.Dispatch(1, 1, "adddata", It.IsAny<JsonElement?>()), Times.Once);
        dispatcherMock.Verify(d => d.Dispatch(1, 1, "deletefield", It.IsAny<JsonElement?>()), Times.Never);
    }

    [Fact]
    public void Process_UnknownType_Returns422()
    {
        var dispatcherMock = new Mock<ICommandDispatcher>();
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "updatefield", It.IsAny<JsonElement?>()))
            .Returns(CommandResult.Ok(new Dictionary<string, object?> { { "field", "hp" } }));
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "unknowncommand", It.IsAny<JsonElement?>()))
            .Returns((CommandResult?)null);
        dispatcherMock.Setup(d => d.Dispatch(1, 1, "adddata", It.IsAny<JsonElement?>()))
            .Returns(CommandResult.Ok(new Dictionary<string, object?> { { "data", "added" } }));

        var processor = new CommandBatchProcessor(dispatcherMock.Object);

        var commands = new List<CharacterCommandRequest>
        {
            new() { Type = "updatefield" },
            new() { Type = "unknowncommand" },
            new() { Type = "adddata" }
        };

        var result = processor.Process(1, 1, commands);

        Assert.Equal(422, result.Status);
        Assert.Equal(2, result.Results.Count);
        Assert.True(result.Results[0].Success);
        Assert.False(result.Results[1].Success);
        Assert.Equal(1, result.FailedIndex);
        Assert.Contains("Unknown command type", result.Results[1].Message);

        dispatcherMock.Verify(d => d.Dispatch(1, 1, "updatefield", It.IsAny<JsonElement?>()), Times.Once);
        dispatcherMock.Verify(d => d.Dispatch(1, 1, "unknowncommand", It.IsAny<JsonElement?>()), Times.Once);
        dispatcherMock.Verify(d => d.Dispatch(1, 1, "adddata", It.IsAny<JsonElement?>()), Times.Never);
    }
}
