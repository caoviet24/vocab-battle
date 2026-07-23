using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using VocabBattle.Api.Infrastructures;
using Xunit;

namespace VocabBattle.UnitTests.Api;

public sealed class GlobalExceptionMiddlewareTests
{
    [Fact]
    public async Task Returns_the_standard_error_envelope()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new GlobalExceptionMiddleware(
            _ => throw new InvalidOperationException("private detail"),
            NullLogger<GlobalExceptionMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        var response = await JsonSerializer.DeserializeAsync<JsonElement>(context.Response.Body);
        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        Assert.Equal("Đã xảy ra lỗi. Vui lòng thử lại sau.", response.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, response.GetProperty("data").ValueKind);
        Assert.False(response.GetProperty("success").GetBoolean());
    }
}
