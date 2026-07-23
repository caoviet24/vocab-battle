using Microsoft.Extensions.Options;
using MongoDB.Driver;
using VocabBattle.Infrastructure.Persistence.Mongo.Documents;

namespace VocabBattle.Infrastructure.Persistence.Mongo;

public sealed class MongoContext
{
    public MongoContext(IOptions<MongoOptions> options)
    {
        var settings = options.Value;
        var database = new MongoClient(settings.ConnectionString).GetDatabase(settings.DatabaseName);
        Cards = database.GetCollection<CardDocument>("cards");
        Categories = database.GetCollection<CategoryDocument>("categories");
        Frames = database.GetCollection<FrameDocument>("frames");
    }

    public IMongoCollection<CardDocument> Cards { get; }
    public IMongoCollection<CategoryDocument> Categories { get; }
    public IMongoCollection<FrameDocument> Frames { get; }
}
