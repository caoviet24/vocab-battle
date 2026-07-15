using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Documents;

[BsonIgnoreExtraElements]
public sealed class CategoryDocument
{
    [BsonId]
    public ObjectId Id { get; init; }

    [BsonElement("name")]
    public string Name { get; init; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; init; } = string.Empty;

    [BsonElement("created_at")]
    public DateTime CreatedAt { get; init; }
}
