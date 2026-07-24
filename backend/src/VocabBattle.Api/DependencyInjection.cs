using VocabBattle.Api.Hubs;
using VocabBattle.Api.Serialization;
using VocabBattle.Api.Security;

namespace VocabBattle.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddApiService(this IServiceCollection services)
    {
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonDefaults.Options.PropertyNamingPolicy;
            options.SerializerOptions.PropertyNameCaseInsensitive = true;
        });

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();
        services.AddCors(options => options.AddDefaultPolicy(policy =>
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod().WithExposedHeaders(AdminSessionStore.HeaderName)));
        services.AddSingleton<CardPayloadCipher>();
        services.AddScoped<GameHub>();
        return services;
    }
}
