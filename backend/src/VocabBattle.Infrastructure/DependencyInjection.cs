using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VocabBattle.Application.Common.Interfaces;
using VocabBattle.Domain.Repositories;
using VocabBattle.Infrastructure.Persistence.Mongo;
using VocabBattle.Infrastructure.Persistence.Mongo.Repositories;
using VocabBattle.Infrastructure.Realtime;

namespace VocabBattle.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<MongoOptions>()
            .Bind(configuration.GetSection(MongoOptions.SectionName))
            .Validate(options => options.ConnectionString.Length > 0, "Mongo connection string is required")
            .Validate(options => options.DatabaseName.Length > 0, "Mongo database name is required")
            .ValidateOnStart();
        services.AddSingleton<MongoContext>();
        services.AddScoped<ICardRepository, MongoCardRepository>();
        services.AddScoped<ICategoryRepository, MongoCategoryRepository>();
        services.AddSingleton<IGameRoomManager, GameRoomManager>();
        return services;
    }
}
