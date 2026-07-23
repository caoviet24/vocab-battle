using Microsoft.AspNetCore.Http;
using VocabBattle.Api.Serialization;

namespace VocabBattle.Api.Infrastructures;

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client disconnected; there is no response to send.
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled request error for {Method} {Path}", context.Request.Method, context.Request.Path);
            if (context.Response.HasStarted) throw;

            context.Response.StatusCode = exception is BadHttpRequestException badRequest
                ? badRequest.StatusCode
                : StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(
                new ErrorResponse("Đã xảy ra lỗi. Vui lòng thử lại sau.", null, false),
                JsonDefaults.Options,
                context.RequestAborted);
        }
    }

    private sealed record ErrorResponse(string Message, object? Data, bool Success);
}
