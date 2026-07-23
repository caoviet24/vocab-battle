using MongoDB.Bson;
using MongoDB.Driver;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Repositories;
using VocabBattle.Infrastructure.Persistence.Mongo.Documents;
using VocabBattle.Infrastructure.Persistence.Mongo.Mappers;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Repositories;

public sealed class MongoFrameRepository(MongoContext context) : IFrameRepository
{
    private static FilterDefinition<FrameDocument> ById(ObjectId id) => Builders<FrameDocument>.Filter.Eq(frame => frame.Id, id);

    public async Task<IReadOnlyList<Frame>> ListAsync(CancellationToken cancellationToken) =>
        (await context.Frames.Find(FilterDefinition<FrameDocument>.Empty).SortByDescending(frame => frame.CreatedAt).ToListAsync(cancellationToken))
            .Select(MongoDocumentMapper.ToDomain).ToArray();

    public async Task<Frame> AddAsync(Frame frame, CancellationToken cancellationToken)
    {
        var document = MongoDocumentMapper.ToDocument(frame);
        await context.Frames.InsertOneAsync(document, cancellationToken: cancellationToken);
        return MongoDocumentMapper.ToDomain(document);
    }

    public async Task<Frame?> UpdateAsync(Frame frame, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(frame.Id, out var id)) return null;
        var update = Builders<FrameDocument>.Update.Set(item => item.Name, frame.Name).Set(item => item.Url, frame.Url);
        var options = new FindOneAndUpdateOptions<FrameDocument> { ReturnDocument = ReturnDocument.After };
        var document = await context.Frames.FindOneAndUpdateAsync(ById(id), update, options, cancellationToken);
        return document is null ? null : MongoDocumentMapper.ToDomain(document);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out var objectId)) return false;
        return (await context.Frames.DeleteOneAsync(ById(objectId), cancellationToken)).DeletedCount > 0;
    }
}
