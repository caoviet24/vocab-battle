using MongoDB.Bson;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.ValueObjects;
using VocabBattle.Infrastructure.Persistence.Mongo.Documents;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Mappers;

public static class MongoDocumentMapper
{
    public static Card ToDomain(CardDocument document) => new(
        document.Id.ToString(),
        document.Word,
        document.Type,
        new BilingualText(document.Explanation.En, document.Explanation.Vi),
        document.Translation,
        new BilingualText(document.Example.En, document.Example.Vi),
        document.Phonetics.Select(item => new Phonetic(item.Text, item.Audio, item.Locale)).ToArray(),
        document.ImageUrl,
        document.Difficulty,
        document.CategoryId.ToString());

    public static CardDocument ToDocument(Card card) => new()
    {
        Id = ParseOrNew(card.Id),
        Word = card.Word,
        Type = card.Type,
        Explanation = new BilingualTextDocument { En = card.Explanation.En, Vi = card.Explanation.Vi },
        Translation = card.Translation,
        Example = new BilingualTextDocument { En = card.Example.En, Vi = card.Example.Vi },
        Phonetics = card.Phonetics.Select(item => new PhoneticDocument { Text = item.Text, Audio = item.Audio, Locale = item.Locale }).ToArray(),
        ImageUrl = card.ImageUrl,
        Difficulty = card.Difficulty,
        CategoryId = ObjectId.TryParse(card.CategoryId, out var categoryObjectId) ? categoryObjectId : ObjectId.Empty
    };

    public static Category ToDomain(CategoryDocument document) =>
        new(document.Id.ToString(), document.Name, document.Description, document.ImageUrl, document.CreatedAt);

    public static CategoryDocument ToDocument(Category category) => new()
    {
        Id = ParseOrNew(category.Id),
        Name = category.Name,
        Description = category.Description,
        ImageUrl = category.ImageUrl,
        CreatedAt = category.CreatedAt == default ? DateTime.UtcNow : category.CreatedAt
    };

    public static Frame ToDomain(FrameDocument document) =>
        new(document.Id.ToString(), document.Name, document.Url, document.CreatedAt);

    public static FrameDocument ToDocument(Frame frame) => new()
    {
        Id = ParseOrNew(frame.Id),
        Name = frame.Name,
        Url = frame.Url,
        CreatedAt = frame.CreatedAt == default ? DateTime.UtcNow : frame.CreatedAt
    };

    private static ObjectId ParseOrNew(string id) =>
        !string.IsNullOrEmpty(id) && ObjectId.TryParse(id, out var objectId) ? objectId : ObjectId.GenerateNewId();
}
