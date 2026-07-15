using VocabBattle.Api.Endpoints;
using VocabBattle.Api.Hubs;
using VocabBattle.Api.Serialization;
using VocabBattle.Application;
using VocabBattle.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

if (builder.Configuration["MONGO_URI"] is { Length: > 0 } mongoUri)
{
    builder.Configuration["Mongo:ConnectionString"] = mongoUri;
}
if (builder.Configuration["DB_NAME"] is { Length: > 0 } databaseName)
{
    builder.Configuration["Mongo:DatabaseName"] = databaseName;
}
if (int.TryParse(builder.Configuration["PORT"], out var port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonDefaults.Options.PropertyNamingPolicy;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<GameHub>();

var app = builder.Build();
app.UseCors();
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
app.MapGet("/health", () => Results.Ok(new { Status = "ok" }));
app.MapCategoryEndpoints();
app.MapCardEndpoints();
app.MapAdminEndpoints();
app.MapGameWebSocket();
app.MapLobbyWebSocket();
app.Run();
