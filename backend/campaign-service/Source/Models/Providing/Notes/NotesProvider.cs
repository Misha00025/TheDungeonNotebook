using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class NotesProvider
{
    private const string NOTES_COLLECTION_NAME = "notes";

    private EntityContext _sql;
    private MongoDbContext _mongo;
    private ILogger<NotesProvider> _logger;

    public NotesProvider(EntityContext context, MongoDbContext mongoDbContext, ILogger<NotesProvider> logger)
    {
        _sql = context;
        _mongo = mongoDbContext;
        _logger = logger;
    }

    public IEnumerable<Note> GetGroupNotes(int groupId)
    {
        return _sql.Notes
            .Where(e => e.GroupId == groupId && e.CharacterId == null)
            .Include(e => e.Group)
            .AsEnumerable()
            .Select(ToNoteWithoutBody)
            .ToList();
    }

    public IEnumerable<Note> GetCharacterNotes(int groupId, int characterId)
    {
        return _sql.Notes
            .Where(e => e.GroupId == groupId && e.CharacterId == characterId)
            .Include(e => e.Group)
            .AsEnumerable()
            .Select(ToNoteWithoutBody)
            .ToList();
    }

    public Note? GetGroupNote(int groupId, int noteId)
    {
        var data = _sql.Notes
            .Where(e => e.GroupId == groupId && e.Id == noteId && e.CharacterId == null)
            .Include(e => e.Group)
            .FirstOrDefault();
        if (data == null) return null;
        return ToNoteWithBody(data);
    }

    public Note? GetCharacterNote(int groupId, int characterId, int noteId)
    {
        var data = _sql.Notes
            .Where(e => e.GroupId == groupId && e.CharacterId == characterId && e.Id == noteId)
            .Include(e => e.Group)
            .FirstOrDefault();
        if (data == null) return null;
        return ToNoteWithBody(data);
    }

    public bool TryCreateGroupNote(int groupId, string header, string? shortDescription, string? body, out Note? note, List<string>? keywords = null)
    {
        return TryCreateNote(groupId, null, header, shortDescription, body, out note, keywords);
    }

    public bool TryCreateCharacterNote(int groupId, int characterId, string header, string? shortDescription, string? body, out Note? note, List<string>? keywords = null)
    {
        return TryCreateNote(groupId, characterId, header, shortDescription, body, out note, keywords);
    }

    private bool TryCreateNote(int groupId, int? characterId, string header, string? shortDescription, string? body, out Note? note, List<string>? keywords = null)
    {
        try
        {
            string? uuid = null;
            if (body != null)
            {
                var mongoData = new NoteMongoData { Body = body };
                _mongo.GetCollection<NoteMongoData>(NOTES_COLLECTION_NAME).InsertOne(mongoData);
                uuid = mongoData.Id.ToString();
            }

            var now = DateTime.UtcNow;
            var sqlData = new NoteData
            {
                GroupId = groupId,
                CharacterId = characterId,
                UUID = uuid ?? "",
                Header = header,
                ShortDescription = shortDescription ?? "",
                AdditionDate = now,
                ModifyDate = now
            };
            _sql.Notes.Add(sqlData);
            _sql.SaveChanges();

            if (keywords != null && keywords.Count > 0)
            {
                foreach (var kw in keywords)
                {
                    _sql.NoteKeywords.Add(new NoteKeywordData { NoteId = sqlData.Id, Keyword = kw });
                }
                _sql.SaveChanges();
            }

            note = new Note
            {
                Id = sqlData.Id,
                GroupId = groupId,
                CharacterId = characterId,
                Header = header,
                ShortDescription = shortDescription ?? "",
                Body = body,
                CreatedAt = now,
                UpdatedAt = now,
                Keywords = keywords ?? new List<string>()
            };
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error creating note: {e}");
            note = null;
            return false;
        }
    }

    public bool TryUpdateGroupNote(int groupId, int noteId, string? header, string? shortDescription, string? body, out Note? note, List<string>? keywords = null)
    {
        return TryUpdateNote(groupId, null, noteId, header, shortDescription, body, out note, keywords);
    }

    public bool TryUpdateCharacterNote(int groupId, int characterId, int noteId, string? header, string? shortDescription, string? body, out Note? note, List<string>? keywords = null)
    {
        return TryUpdateNote(groupId, characterId, noteId, header, shortDescription, body, out note, keywords);
    }

    private bool TryUpdateNote(int groupId, int? characterId, int noteId, string? header, string? shortDescription, string? body, out Note? note, List<string>? keywords = null)
    {
        try
        {
            var sqlData = _sql.Notes
                .FirstOrDefault(e => e.GroupId == groupId && e.CharacterId == characterId && e.Id == noteId);
            if (sqlData == null)
            {
                note = null;
                return false;
            }

            if (header != null) sqlData.Header = header;
            if (shortDescription != null) sqlData.ShortDescription = shortDescription;
            sqlData.ModifyDate = DateTime.UtcNow;

            if (body != null)
            {
                if (!string.IsNullOrEmpty(sqlData.UUID))
                {
                    var mongoData = new NoteMongoData
                    {
                        Id = new ObjectId(sqlData.UUID),
                        Body = body
                    };
                    _mongo.GetCollection<NoteMongoData>(NOTES_COLLECTION_NAME)
                        .ReplaceOne(
                            Builders<NoteMongoData>.Filter.Eq(x => x.Id, mongoData.Id),
                            mongoData);
                }
                else
                {
                    var mongoData = new NoteMongoData { Body = body };
                    _mongo.GetCollection<NoteMongoData>(NOTES_COLLECTION_NAME).InsertOne(mongoData);
                    sqlData.UUID = mongoData.Id.ToString();
                }
            }

            if (keywords != null)
            {
                var oldKeywords = _sql.NoteKeywords.Where(e => e.NoteId == sqlData.Id);
                _sql.NoteKeywords.RemoveRange(oldKeywords);
                foreach (var kw in keywords)
                {
                    _sql.NoteKeywords.Add(new NoteKeywordData { NoteId = sqlData.Id, Keyword = kw });
                }
            }

            _sql.SaveChanges();

            note = ToNoteWithBody(sqlData);
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error updating note: {e}");
            note = null;
            return false;
        }
    }

    public List<string> GetGroupKeywords(int groupId)
    {
        return _sql.NoteKeywords
            .Include(e => e.Note)
            .Where(e => e.Note!.GroupId == groupId)
            .Select(e => e.Keyword)
            .Distinct()
            .OrderBy(k => k)
            .ToList();
    }

    public List<string> GetCharacterKeywords(int groupId, int characterId)
    {
        return _sql.NoteKeywords
            .Include(e => e.Note)
            .Where(e => e.Note!.GroupId == groupId && e.Note!.CharacterId == characterId)
            .Select(e => e.Keyword)
            .Distinct()
            .OrderBy(k => k)
            .ToList();
    }

    public bool TryDeleteGroupNote(int groupId, int noteId)
    {
        return TryDeleteNote(groupId, null, noteId);
    }

    public bool TryDeleteCharacterNote(int groupId, int characterId, int noteId)
    {
        return TryDeleteNote(groupId, characterId, noteId);
    }

    private bool TryDeleteNote(int groupId, int? characterId, int noteId)
    {
        try
        {
            var sqlData = _sql.Notes
                .FirstOrDefault(e => e.GroupId == groupId && e.CharacterId == characterId && e.Id == noteId);
            if (sqlData == null) return false;

            if (!string.IsNullOrEmpty(sqlData.UUID))
            {
                var collection = _mongo.GetCollection<NoteMongoData>(NOTES_COLLECTION_NAME);
                collection.DeleteOne(Builders<NoteMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)));
            }

            _sql.Notes.Remove(sqlData);
            _sql.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error deleting note: {e}");
            return false;
        }
    }

    private List<string> GetKeywords(int noteId)
    {
        return _sql.NoteKeywords
            .Where(e => e.NoteId == noteId)
            .Select(e => e.Keyword)
            .ToList();
    }

    private Note ToNoteWithoutBody(NoteData data)
    {
        return new Note
        {
            Id = data.Id,
            GroupId = data.GroupId,
            CharacterId = data.CharacterId,
            Header = data.Header,
            ShortDescription = data.ShortDescription,
            CreatedAt = data.AdditionDate,
            UpdatedAt = data.ModifyDate,
            Keywords = GetKeywords(data.Id)
        };
    }

    private Note ToNoteWithBody(NoteData data)
    {
        var note = ToNoteWithoutBody(data);
        if (!string.IsNullOrEmpty(data.UUID))
        {
            var mongoData = _mongo.GetEntity<NoteMongoData>(NOTES_COLLECTION_NAME, data.UUID);
            note.Body = mongoData?.Body;
        }
        return note;
    }
}
