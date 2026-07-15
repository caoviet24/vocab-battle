using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Repositories;
using VocabBattle.Infrastructure.Persistence.Mongo.Documents;
using VocabBattle.Infrastructure.Persistence.Mongo.Mappers;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Repositories;

public sealed class MongoCardRepository(MongoContext context) : ICardRepository
{
    public async Task<IReadOnlyList<Card>> GetRandomAsync(
        string categoryId,
        int count,
        CancellationToken cancellationToken)
    {
        var stages = new List<BsonDocument>();
        if (categoryId is not ("" or "random") && ObjectId.TryParse(categoryId, out var objectId))
        {
            stages.Add(new BsonDocument("$match", new BsonDocument("category_id", objectId)));
        }

        stages.Add(new BsonDocument("$sample", new BsonDocument("size", count)));
        var documents = await context.Cards.Aggregate<CardDocument>(stages).ToListAsync(cancellationToken);
        return documents.Select(MongoDocumentMapper.ToDomain).ToArray();
    }

    public async Task<(IReadOnlyList<Card> Cards, long Total)> ListAsync(
        string? categoryId, string? search, int skip, int limit, CancellationToken cancellationToken)
    {
        var filter = BuildFilter(categoryId, search);

        var total = await context.Cards.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var documents = await context.Cards.Find(filter)
            // ponytail: sort by _id desc as a proxy for newest — cards have no created_at field
            .SortByDescending(c => c.Id)
            .Skip(skip)
            .Limit(limit)
            .ToListAsync(cancellationToken);

        return (documents.Select(MongoDocumentMapper.ToDomain).ToArray(), total);
    }

    public async Task<Card> AddAsync(Card card, CancellationToken cancellationToken)
    {
        var document = MongoDocumentMapper.ToDocument(card);
        await context.Cards.InsertOneAsync(document, cancellationToken: cancellationToken);
        return MongoDocumentMapper.ToDomain(document);
    }

    public async Task<Card?> UpdateAsync(Card card, CancellationToken cancellationToken)
    {
        var document = MongoDocumentMapper.ToDocument(card);
        var result = await context.Cards.ReplaceOneAsync(c => c.Id == document.Id, document, cancellationToken: cancellationToken);
        return result.MatchedCount == 0 ? null : MongoDocumentMapper.ToDomain(document);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out var objectId))
        {
            return false;
        }

        var result = await context.Cards.DeleteOneAsync(c => c.Id == objectId, cancellationToken);
        return result.DeletedCount > 0;
    }

    private static FilterDefinition<CardDocument> BuildFilter(string? categoryId, string? search)
    {
        var builder = Builders<CardDocument>.Filter;
        var filter = builder.Empty;

        if (!string.IsNullOrWhiteSpace(categoryId) && ObjectId.TryParse(categoryId, out var objectId))
        {
            filter &= builder.Eq(c => c.CategoryId, objectId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            filter &= builder.Regex(c => c.Word, new BsonRegularExpression(Regex.Escape(search), "i"));
        }

        return filter;
    }
}
