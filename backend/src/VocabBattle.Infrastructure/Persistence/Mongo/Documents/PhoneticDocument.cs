using MongoDB.Bson.Serialization.Attributes;

namespace VocabBattle.Infrastructure.Persistence.Mongo.Documents;

public sealed class PhoneticDocument
{
    [BsonElement("text")]
    public string Text { get; init; } = string.Empty;

    [BsonElement("audio")]
    public string Audio { get; init; } = string.Empty;

    [BsonElement("locale")]
    public string Locale { get; init; } = string.Empty;
}
