using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Documents;

[BsonIgnoreExtraElements]
public sealed class FrameDocument
{
    [BsonId]
    public ObjectId Id { get; init; }

    [BsonElement("name")]
    public string Name { get; init; } = string.Empty;

    [BsonElement("url")]
    public string Url { get; init; } = string.Empty;

    [BsonElement("created_at")]
    public DateTime CreatedAt { get; init; }
}
