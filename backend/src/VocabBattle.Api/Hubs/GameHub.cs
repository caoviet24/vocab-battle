using System.Net.WebSockets;
using System.Text.Json;
using MediatR;
using VocabBattle.Api.Contracts;
using VocabBattle.Api.Serialization;
using VocabBattle.Application.Common.Interfaces;
using VocabBattle.Application.Features.Game.Commands;
using VocabBattle.Domain.Exceptions;

namespace VocabBattle.Api.Hubs;

public sealed class GameHub(IMediator mediator, IGameRoomManager rooms, ILogger<GameHub> logger)
{
    private const int MaxMessageBytes = 64 * 1024;

    public async Task HandleAsync(HttpContext context)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        var roomCode = context.Request.RouteValues["roomCode"]?.ToString()?.ToUpperInvariant() ?? string.Empty;
        var playerId = context.Request.Query["playerId"].ToString();
        var playerName = context.Request.Query["playerName"].ToString();
        var frameUrl = context.Request.Query["frameUrl"].ToString();
        if (roomCode.Length == 0 || playerId.Length == 0 || playerName.Length == 0 || !IsValidFrameUrl(frameUrl))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        var client = new WebSocketGameClient(socket);
        var connection = new RoomConnection(
            roomCode,
            playerId,
            playerName,
            context.Request.Query["password"].ToString(),
            context.Request.Query["isHost"] == "1",
            frameUrl);

        try
        {
            await rooms.ConnectAsync(connection, client, context.RequestAborted);
            while (socket.State == WebSocketState.Open && !context.RequestAborted.IsCancellationRequested)
            {
                var bytes = await ReceiveMessageAsync(socket, context.RequestAborted);
                if (bytes is null)
                {
                    break;
                }

                await DispatchAsync(bytes, roomCode, playerId, client, context.RequestAborted);
            }
        }
        catch (GameRuleException exception)
        {
            await TrySendErrorAsync(client, exception.Code, exception.Message);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
        }
        catch (WebSocketException exception)
        {
            logger.LogDebug(exception, "WebSocket disconnected for player {PlayerId}", playerId);
        }
        finally
        {
            await rooms.DisconnectAsync(roomCode, playerId, client, CancellationToken.None);
            await client.CloseAsync(CancellationToken.None);
        }
    }

    private async Task DispatchAsync(
        byte[] bytes,
        string roomCode,
        string playerId,
        IGameClient client,
        CancellationToken cancellationToken)
    {
        try
        {
            var message = JsonSerializer.Deserialize<IncomingMessage>(bytes, JsonDefaults.Options)
                ?? throw new JsonException("Empty message");
            switch (message.Type)
            {
                case "START_GAME":
                    var start = message.Payload.Deserialize<StartGamePayload>(JsonDefaults.Options)
                        ?? throw new JsonException("Missing START_GAME payload");
                    await mediator.Send(
                        new StartGameCommand(roomCode, playerId, start.CategoryId, start.TotalQuestions),
                        cancellationToken);
                    break;
                case "SUBMIT_ANSWER":
                    var answer = message.Payload.Deserialize<AnswerPayload>(JsonDefaults.Options)
                        ?? throw new JsonException("Missing SUBMIT_ANSWER payload");
                    await mediator.Send(new SubmitAnswerCommand(roomCode, playerId, answer.Answer), cancellationToken);
                    break;
                case "TIMEOUT":
                    await mediator.Send(new TimeoutCommand(roomCode, playerId), cancellationToken);
                    break;
                case "GET_PHONETICS":
                    await mediator.Send(new SendPhoneticsCommand(roomCode, playerId), cancellationToken);
                    break;
                case "SET_READY":
                    await mediator.Send(new SetReadyCommand(roomCode, playerId), cancellationToken);
                    break;
                default:
                    await client.SendAsync(
                        "ERROR",
                        new ErrorPayload("UNKNOWN_MESSAGE", "Loại message không được hỗ trợ"),
                        cancellationToken);
                    break;
            }
        }
        catch (GameRuleException exception)
        {
            await client.SendAsync("ERROR", new ErrorPayload(exception.Code, exception.Message), cancellationToken);
        }
        catch (JsonException)
        {
            await client.SendAsync(
                "ERROR",
                new ErrorPayload("INVALID_MESSAGE", "Message WebSocket không hợp lệ"),
                cancellationToken);
        }
    }

    private static async Task<byte[]?> ReceiveMessageAsync(WebSocket socket, CancellationToken cancellationToken)
    {
        var buffer = new byte[4096];
        using var stream = new MemoryStream();
        while (true)
        {
            var result = await socket.ReceiveAsync(buffer, cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                return null;
            }

            if (result.MessageType != WebSocketMessageType.Text)
            {
                throw new JsonException("Only text messages are supported");
            }

            await stream.WriteAsync(buffer.AsMemory(0, result.Count), cancellationToken);
            if (stream.Length > MaxMessageBytes)
            {
                throw new JsonException("Message is too large");
            }

            if (result.EndOfMessage)
            {
                return stream.ToArray();
            }
        }
    }

    private static async Task TrySendErrorAsync(IGameClient client, string code, string message)
    {
        try
        {
            await client.SendAsync("ERROR", new ErrorPayload(code, message), CancellationToken.None);
        }
        catch (WebSocketException)
        {
        }
    }

    private static bool IsValidFrameUrl(string value) =>
        value.Length <= 2_048 && (value.Length == 0 ||
            Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https");
}
