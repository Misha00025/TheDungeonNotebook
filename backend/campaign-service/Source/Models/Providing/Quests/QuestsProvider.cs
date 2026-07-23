using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class QuestsProvider
{
    private const string QUESTS_COLLECTION_NAME = "quests";

    private EntityContext _sql;
    private MongoDbContext _mongo;
    private GroupAccessHelper _accessHelper;
    private ILogger<QuestsProvider> _logger;

    public QuestsProvider(EntityContext context, MongoDbContext mongoDbContext, GroupAccessHelper accessHelper, ILogger<QuestsProvider> logger)
    {
        _sql = context;
        _mongo = mongoDbContext;
        _accessHelper = accessHelper;
        _logger = logger;
    }

    private static Group ToGroup(GroupData data) => new()
    {
        Id = data.Id,
        Name = data.Name,
        Description = data.Name
    };

    private Quest ToQuest(QuestData data, QuestMongoData mongoData)
    {
        var quest = new Quest(ToGroup(data.Group));
        quest.Id = data.Id;
        quest.Header = mongoData.Header;
        quest.Description = mongoData.Description;
        quest.Reward = mongoData.Reward;
        quest.Status = mongoData.Status;
        quest.Objectives = mongoData.Objectives.Select(o => new Objective
        {
            Key = o.Key,
            Description = o.Description,
            Status = o.Status
        }).ToList();
        var assignments = _sql.QuestAssignments
            .Where(e => e.QuestId == data.Id)
            .ToList();
        quest.AssignedCharacters = assignments.Select(e => e.CharacterId).ToList();
        return quest;
    }

    private Quest? GetQuestInternal(QuestData data)
    {
        var mongoData = _mongo.GetEntity<QuestMongoData>(QUESTS_COLLECTION_NAME, data.UUID);
        if (mongoData == null)
            return null;
        return ToQuest(data, mongoData);
    }

    public List<Quest> GetQuests(int groupId, int? userId, int? characterId)
    {
        var query = _sql.Quests
            .Where(e => e.GroupId == groupId)
            .Include(e => e.Group)
            .AsQueryable();

        if (userId != null && !_accessHelper.IsAdmin(groupId, userId.Value))
        {
            var accessibleCharacterIds = _accessHelper.GetAccessibleCharacterIds(groupId, userId.Value);
            var questIdsWithAccess = _sql.QuestAssignments
                .Where(a => accessibleCharacterIds.Contains(a.CharacterId))
                .Select(a => a.QuestId)
                .Distinct()
                .ToList();
            query = query.Where(e => questIdsWithAccess.Contains(e.Id));
        }

        if (characterId != null)
        {
            var questIdsForCharacter = _sql.QuestAssignments
                .Where(a => a.CharacterId == characterId.Value)
                .Select(a => a.QuestId)
                .Distinct()
                .ToList();
            query = query.Where(e => questIdsForCharacter.Contains(e.Id));
        }

        return query.ToList()
            .Select(GetQuestInternal)
            .Where(e => e != null)
            .Cast<Quest>()
            .ToList();
    }

    public Quest? GetQuest(int groupId, int questId)
    {
        var data = _sql.Quests
            .Where(e => e.GroupId == groupId && e.Id == questId)
            .Include(e => e.Group)
            .FirstOrDefault();
        if (data == null)
            return null;
        return GetQuestInternal(data);
    }

    public bool TryCreateQuest(int groupId, Quest quest)
    {
        try
        {
            var mongoData = new QuestMongoData()
            {
                Header = quest.Header,
                Description = quest.Description,
                Reward = quest.Reward,
                Status = quest.Status,
                Objectives = quest.Objectives.Select(o => new ObjectiveMongoData()
                {
                    Key = o.Key,
                    Description = o.Description,
                    Status = o.Status
                }).ToList()
            };
            _mongo.GetCollection<QuestMongoData>(QUESTS_COLLECTION_NAME).InsertOne(mongoData);

            var sqlData = new QuestData()
            {
                GroupId = groupId,
                UUID = mongoData.Id.ToString(),
                Header = quest.Header,
                Status = quest.Status
            };
            _sql.Quests.Add(sqlData);
            _sql.SaveChanges();
            quest.Id = sqlData.Id;

            foreach (var characterId in quest.AssignedCharacters)
            {
                _sql.QuestAssignments.Add(new QuestAssignmentData()
                {
                    QuestId = sqlData.Id,
                    CharacterId = characterId
                });
            }
            _sql.SaveChanges();

            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error creating quest: {e}");
            return false;
        }
    }

    public bool TryUpdateQuest(int groupId, Quest quest)
    {
        try
        {
            var sqlData = _sql.Quests
                .FirstOrDefault(e => e.GroupId == groupId && e.Id == quest.Id);
            if (sqlData == null)
                return false;

            var mongoData = new QuestMongoData()
            {
                Id = new ObjectId(sqlData.UUID),
                Header = quest.Header,
                Description = quest.Description,
                Reward = quest.Reward,
                Status = quest.Status,
                Objectives = quest.Objectives.Select(o => new ObjectiveMongoData()
                {
                    Key = o.Key,
                    Description = o.Description,
                    Status = o.Status
                }).ToList()
            };

            var collection = _mongo.GetCollection<QuestMongoData>(QUESTS_COLLECTION_NAME);
            var mongoResult = collection.ReplaceOne(
                Builders<QuestMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)),
                mongoData);

            if (!mongoResult.IsAcknowledged)
                return false;

            sqlData.Header = quest.Header;
            sqlData.Status = quest.Status;

            var oldAssignments = _sql.QuestAssignments
                .Where(e => e.QuestId == sqlData.Id)
                .ToList();
            _sql.QuestAssignments.RemoveRange(oldAssignments);

            foreach (var characterId in quest.AssignedCharacters)
            {
                _sql.QuestAssignments.Add(new QuestAssignmentData()
                {
                    QuestId = sqlData.Id,
                    CharacterId = characterId
                });
            }

            _sql.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error updating quest: {e}");
            return false;
        }
    }

    public bool TryDeleteQuest(int groupId, int questId)
    {
        try
        {
            var sqlData = _sql.Quests
                .FirstOrDefault(e => e.GroupId == groupId && e.Id == questId);
            if (sqlData == null)
                return false;

            var collection = _mongo.GetCollection<QuestMongoData>(QUESTS_COLLECTION_NAME);
            _sql.Quests.Remove(sqlData);
            _sql.SaveChanges();

            var mongoResult = collection.DeleteOne(
                Builders<QuestMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)));
            return mongoResult.IsAcknowledged;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error deleting quest: {e}");
            return false;
        }
    }

    public bool TryPatchQuest(int groupId, int questId, QuestPatchData patch)
    {
        try
        {
            var sqlData = _sql.Quests
                .FirstOrDefault(e => e.GroupId == groupId && e.Id == questId);
            if (sqlData == null)
                return false;

            var collection = _mongo.GetCollection<QuestMongoData>(QUESTS_COLLECTION_NAME);
            var filter = Builders<QuestMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID));
            var mongoData = collection.Find(filter).FirstOrDefault();
            if (mongoData == null)
                return false;

            var updates = new List<UpdateDefinition<QuestMongoData>>();

            if (patch.Header != null)
            {
                updates.Add(Builders<QuestMongoData>.Update.Set(x => x.Header, patch.Header));
                sqlData.Header = patch.Header;
            }
            if (patch.Description != null)
                updates.Add(Builders<QuestMongoData>.Update.Set(x => x.Description, patch.Description));
            if (patch.Reward != null)
                updates.Add(Builders<QuestMongoData>.Update.Set(x => x.Reward, patch.Reward));
            if (patch.Status != null)
            {
                updates.Add(Builders<QuestMongoData>.Update.Set(x => x.Status, patch.Status));
                sqlData.Status = patch.Status;
            }

            // Handle objectives: read doc, modify in memory, save back
            if (mongoData.Objectives != null && patch.Objectives != null)
            {
                foreach (var objPatch in patch.Objectives)
                {
                    var target = mongoData.Objectives
                        .FirstOrDefault(o => o.Key == objPatch.Key);
                    if (target != null)
                    {
                        if (objPatch.Description != null)
                            target.Description = objPatch.Description;
                        if (objPatch.Status != null)
                            target.Status = objPatch.Status;
                    }
                    else
                    {
                        // Create new objective if key not found
                        mongoData.Objectives.Add(new ObjectiveMongoData
                        {
                            Key = objPatch.Key,
                            Description = objPatch.Description ?? "",
                            Status = objPatch.Status ?? "pending"
                        });
                    }
                }
                
                // Mark for replacement
                updates.Add(Builders<QuestMongoData>.Update.Set(
                    x => x.Objectives, mongoData.Objectives));
            }

            if (updates.Count > 0)
            {
                var combinedUpdate = Builders<QuestMongoData>.Update.Combine(updates);
                collection.UpdateOne(filter, combinedUpdate);
            }

            if (patch.AssignedCharacters != null)
            {
                var oldAssignments = _sql.QuestAssignments
                    .Where(e => e.QuestId == sqlData.Id)
                    .ToList();
                _sql.QuestAssignments.RemoveRange(oldAssignments);

                foreach (var characterId in patch.AssignedCharacters)
                {
                    _sql.QuestAssignments.Add(new QuestAssignmentData()
                    {
                        QuestId = sqlData.Id,
                        CharacterId = characterId
                    });
                }
            }

            _sql.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error patching quest: {e}");
            return false;
        }
    }

    public bool TryUpdateObjectiveStatus(int groupId, int questId, string objectiveKey, string status)
    {
        try
        {
            var sqlData = _sql.Quests
                .FirstOrDefault(e => e.GroupId == groupId && e.Id == questId);
            if (sqlData == null)
                return false;

            var collection = _mongo.GetCollection<QuestMongoData>(QUESTS_COLLECTION_NAME);
            var filter = Builders<QuestMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID));
            var update = Builders<QuestMongoData>.Update.Set("objectives.$[elem].status", status);
            var arrayFilters = new List<ArrayFilterDefinition>
            {
                new BsonDocumentArrayFilterDefinition<BsonDocument>(
                    new BsonDocument("elem.key", objectiveKey))
            };
            var result = collection.UpdateOne(filter, update, new UpdateOptions { ArrayFilters = arrayFilters });
            return result.IsAcknowledged && result.ModifiedCount > 0;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error updating objective status: {e}");
            return false;
        }
    }
}
