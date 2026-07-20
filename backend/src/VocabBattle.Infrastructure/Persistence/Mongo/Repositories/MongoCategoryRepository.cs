using MongoDB.Bson;
using MongoDB.Driver;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Repositories;
using VocabBattle.Infrastructure.Persistence.Mongo.Documents;
using VocabBattle.Infrastructure.Persistence.Mongo.Mappers;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Repositories;

public sealed class MongoCategoryRepository(MongoContext context) : ICategoryRepository
{
    private static FilterDefinition<CategoryDocument> ById(ObjectId id) =>
        Builders<CategoryDocument>.Filter.Eq(c => c.Id, id);

    public async Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken)
    {
        var documents = await context.Categories.Find(FilterDefinition<CategoryDocument>.Empty)
            .ToListAsync(cancellationToken);
        return documents.Select(MongoDocumentMapper.ToDomain).ToArray();
    }

    public async Task<Category?> GetByIdAsync(string id, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out var objectId))
        {
            return null;
        }

        var document = await context.Categories.Find(ById(objectId)).FirstOrDefaultAsync(cancellationToken);
        return document is null ? null : MongoDocumentMapper.ToDomain(document);
    }

    public async Task<Category> AddAsync(Category category, CancellationToken cancellationToken)
    {
        var document = MongoDocumentMapper.ToDocument(category);
        await context.Categories.InsertOneAsync(document, cancellationToken: cancellationToken);
        return MongoDocumentMapper.ToDomain(document);
    }

    public async Task<Category?> UpdateAsync(Category category, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(category.Id, out var objectId))
        {
            return null;
        }

        var update = Builders<CategoryDocument>.Update
            .Set(c => c.Name, category.Name)
            .Set(c => c.Description, category.Description)
            .Set(c => c.ImageUrl, category.ImageUrl);

        var options = new FindOneAndUpdateOptions<CategoryDocument> { ReturnDocument = ReturnDocument.After };
        var document = await context.Categories.FindOneAndUpdateAsync(ById(objectId), update, options, cancellationToken);
        return document is null ? null : MongoDocumentMapper.ToDomain(document);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out var objectId))
        {
            return false;
        }

        var result = await context.Categories.DeleteOneAsync(ById(objectId), cancellationToken);
        return result.DeletedCount > 0;
    }
}
