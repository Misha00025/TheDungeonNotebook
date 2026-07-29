using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Models;
using Tdn.Models.Providing;
using Tdn.Tests.Fixtures;

namespace Tdn.Tests.Source;

public class NotesProviderTests
{
    [Fact]
    public void GetGroupNotes_ReturnsOnlyGroupNotes()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Notes.Add(new NoteData { Id = 10, GroupId = 1, CharacterId = null, Header = "GroupNote1" });
            db.Notes.Add(new NoteData { Id = 20, GroupId = 1, CharacterId = null, Header = "GroupNote2" });
            db.Notes.Add(new NoteData { Id = 30, GroupId = 1, CharacterId = 100, Header = "CharNote" });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var loggerMock = new Mock<ILogger<NotesProvider>>();
        
        var provider = new NotesProvider(ctx, mongoMock.Object, loggerMock.Object);
        
        var notes = provider.GetGroupNotes(1);
        
        Assert.Equal(2, notes.Count());
    }

    [Fact]
    public void GetCharacterNotes_ReturnsOnlyCharacterNotes()
    {
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Notes.Add(new NoteData { Id = 10, GroupId = 1, CharacterId = 100, Header = "CharNote1" });
            db.Notes.Add(new NoteData { Id = 20, GroupId = 1, CharacterId = 100, Header = "CharNote2" });
            db.Notes.Add(new NoteData { Id = 30, GroupId = 1, CharacterId = null, Header = "GroupNote" });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var loggerMock = new Mock<ILogger<NotesProvider>>();
        
        var provider = new NotesProvider(ctx, mongoMock.Object, loggerMock.Object);
        
        var notes = provider.GetCharacterNotes(1, 100);
        
        Assert.Equal(2, notes.Count());
    }

    [Fact]
    public void GetGroupNote_WhenExists_ReturnsNoteWithBody()
    {
        var uuid = ObjectId.GenerateNewId().ToString();
        using var ctx = TestCampaignContextFactory.CreateWithData(db =>
        {
            db.Groups.Add(new GroupData { Id = 1, Name = "TestGroup" });
            db.Notes.Add(new NoteData { Id = 10, GroupId = 1, CharacterId = null, Header = "TestNote", UUID = uuid });
        });
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        mongoMock.Setup(m => m.GetEntity<NoteMongoData>("notes", uuid))
            .Returns(new NoteMongoData { Body = "Note body content" });
        var loggerMock = new Mock<ILogger<NotesProvider>>();
        
        var provider = new NotesProvider(ctx, mongoMock.Object, loggerMock.Object);
        
        var note = provider.GetGroupNote(1, 10);
        
        Assert.NotNull(note);
        Assert.Equal("TestNote", note.Header);
        Assert.Equal("Note body content", note.Body);
    }

    [Fact]
    public void GetGroupNote_WhenNotExists_ReturnsNull()
    {
        using var ctx = TestCampaignContextFactory.Create();
        var mongoMock = new Mock<IMongoDbContext>(MockBehavior.Loose);
        var loggerMock = new Mock<ILogger<NotesProvider>>();
        
        var provider = new NotesProvider(ctx, mongoMock.Object, loggerMock.Object);
        
        var note = provider.GetGroupNote(1, 999);
        
        Assert.Null(note);
    }
}
