using VocabBattle.Api;
using VocabBattle.Api.Infrastructures;
using VocabBattle.Api.Security;
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
// ponytail: in-memory sessions; use shared auth/session storage when running multiple API replicas.
builder.Services.AddSingleton(new AdminSessionStore(builder.Configuration["ADMIN_OTP"] ?? "031024"));


var app = builder.Build();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.Use(async (context, next) =>
{
    var isAdmin = context.Request.Headers.TryGetValue(AdminSessionStore.HeaderName, out var token) &&
        context.RequestServices.GetRequiredService<AdminSessionStore>().IsValid(token);
    var isAdminRoute = context.Request.Path.StartsWithSegments("/api/admin");

    if (isAdminRoute && context.Request.Path != "/api/admin/login" && !isAdmin)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }

    if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method) &&
        context.Request.Path != "/api/admin/login" && !isAdmin)
    {
        context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
        return;
    }

    await next();
});
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
app.MapGet("/health", () => Results.Ok(new { Status = "ok" }));
app.MapPost("/api/admin/login", (AdminLoginRequest input, AdminSessionStore sessions, HttpResponse response) =>
{
    if (!sessions.IsValidOtp(input.Code)) return Results.Unauthorized();

    response.Headers[AdminSessionStore.HeaderName] = sessions.Create();
    return Results.NoContent();
});
app.MapEndpoints();
app.Run();

internal sealed record AdminLoginRequest(string? Code);
