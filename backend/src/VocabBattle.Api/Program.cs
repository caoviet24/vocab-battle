using VocabBattle.Api;
using VocabBattle.Api.Infrastructures;
using VocabBattle.Application;
using VocabBattle.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

if (builder.Configuration["MONGO_URI"] is { Length: > 0 } mongoUri)
{
    builder.Configuration["Mongo:ConnectionString"] = mongoUri;
}
if (int.TryParse(builder.Configuration["PORT"], out var port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApiService();


var app = builder.Build();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
app.MapGet("/health", () => Results.Ok(new { Status = "ok" }));
app.MapEndpoints();
app.Run();
