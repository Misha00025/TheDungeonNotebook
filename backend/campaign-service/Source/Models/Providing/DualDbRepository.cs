using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public abstract class DualDbRepository<TEntity, TSqlData, TMongoData>
    where TSqlData : GroupEntityData
    where TMongoData : MongoDbContextBase.MongoEntity
{
    protected CampaignContext Db { get; }
    protected IMongoDbContext Mongo { get; }
    protected ILogger Logger { get; }

    protected DualDbRepository(CampaignContext db, IMongoDbContext mongo, ILogger logger)
    {
        Db = db;
        Mongo = mongo;
        Logger = logger;
    }

    protected abstract string CollectionName { get; }
    protected abstract TEntity ToDomain(TSqlData sqlData, TMongoData mongoData);
    protected abstract TMongoData ToMongoData(TEntity entity);
    protected abstract Expression<Func<TSqlData, bool>> GroupFilter(int groupId);
    protected abstract Expression<Func<TSqlData, bool>> IdFilter(int groupId, int entityId);
    protected abstract int GetGroupId(TEntity entity);
    protected abstract int GetEntityId(TEntity entity);
    protected abstract void SetEntityId(TEntity entity, int id);

    protected TEntity FromSqlData(TSqlData sqlData)
    {
        var mongoData = Mongo.GetEntity<TMongoData>(CollectionName, sqlData.UUID);
        return ToDomain(sqlData, mongoData!);
    }

    protected static Group ToGroup(GroupData data) => new()
    {
        Id = data.Id,
        Name = data.Name,
        Description = data.Name
    };

    protected TEntity? Get(int groupId, int entityId)
    {
        var sqlData = Db.Set<TSqlData>()
            .Where(IdFilter(groupId, entityId))
            .Include(e => e.Group)
            .FirstOrDefault();
        if (sqlData == null)
            return default;
        var mongoData = Mongo.GetEntity<TMongoData>(CollectionName, sqlData.UUID)!;
        return ToDomain(sqlData, mongoData);
    }

    protected IEnumerable<TEntity> GetByGroup(int groupId)
    {
        return Db.Set<TSqlData>()
            .Where(GroupFilter(groupId))
            .Include(e => e.Group)
            .AsEnumerable()
            .Select(sqlData =>
            {
                var mongoData = Mongo.GetEntity<TMongoData>(CollectionName, sqlData.UUID)!;
                return ToDomain(sqlData, mongoData);
            })
            .ToList();
    }

    protected bool TryCreate(int groupId, TEntity entity)
    {
        try
        {
            var mongoData = ToMongoData(entity);
            Mongo.GetCollection<TMongoData>(CollectionName).InsertOne(mongoData);
            var sqlData = (TSqlData)Activator.CreateInstance(typeof(TSqlData))!;
            sqlData.GroupId = groupId;
            sqlData.UUID = mongoData.Id.ToString();
            Db.Set<TSqlData>().Add(sqlData);
            Db.SaveChanges();
            SetEntityId(entity, sqlData.Id);
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error creating {typeof(TEntity).Name}: {e}");
            return false;
        }
    }

    protected bool TryUpdate(TEntity entity)
    {
        try
        {
            var sqlData = Db.Set<TSqlData>()
                .Include(e => e.Group)
                .FirstOrDefault(IdFilter(GetGroupId(entity), GetEntityId(entity)));
            if (sqlData == null)
                return false;

            var mongoData = ToMongoData(entity);
            mongoData.Id = new ObjectId(sqlData.UUID);

            var result = Mongo.GetCollection<TMongoData>(CollectionName)
                .ReplaceOne(
                    Builders<TMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)),
                    mongoData);
            return result.IsAcknowledged && result.ModifiedCount > 0;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error updating {typeof(TEntity).Name}: {e}");
            return false;
        }
    }

    protected bool TryDelete(int groupId, int entityId)
    {
        try
        {
            var sqlData = Db.Set<TSqlData>().FirstOrDefault(IdFilter(groupId, entityId));
            if (sqlData == null)
                return false;
            Mongo.GetCollection<TMongoData>(CollectionName)
                .DeleteOne(Builders<TMongoData>.Filter.Eq(x => x.Id, new ObjectId(sqlData.UUID)));
            Db.Set<TSqlData>().Remove(sqlData);
            Db.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error deleting {typeof(TEntity).Name}: {e}");
            return false;
        }
    }
}
