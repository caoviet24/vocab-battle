using MongoDB.Bson.Serialization.Attributes;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Documents;

public sealed class BilingualTextDocument
{
    [BsonElement("en")]
    public string En { get; init; } = string.Empty;

    [BsonElement("vi")]
    public string Vi { get; init; } = string.Empty;
}
