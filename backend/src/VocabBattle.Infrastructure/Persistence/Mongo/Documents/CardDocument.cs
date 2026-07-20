using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Documents;

[BsonIgnoreExtraElements]
public sealed class CardDocument
{
    [BsonId]
    public ObjectId Id { get; init; }

    [BsonElement("word")]
    public string Word { get; init; } = string.Empty;

    [BsonElement("type")]
    public string Type { get; init; } = string.Empty;

    [BsonElement("explanation")]
    public BilingualTextDocument Explanation { get; init; } = new();

    [BsonElement("translation")]
    public string Translation { get; init; } = string.Empty;

    [BsonElement("example")]
    public BilingualTextDocument Example { get; init; } = new();

    [BsonElement("phonetics")]
    public IReadOnlyList<PhoneticDocument> Phonetics { get; init; } = [];

    [BsonElement("image_url")]
    public string ImageUrl { get; init; } = string.Empty;

    [BsonElement("difficulty")]
    public string Difficulty { get; init; } = string.Empty;

    [BsonElement("category_id")]
    public ObjectId CategoryId { get; init; }
}
