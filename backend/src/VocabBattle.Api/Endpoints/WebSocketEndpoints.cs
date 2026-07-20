using System.Net.WebSockets;
using VocabBattle.Api.Hubs;
using VocabBattle.Api.Infrastructures;
using VocabBattle.Application.Common.Interfaces;

namespace VocabBattle.Api.Endpoints;

public sealed class WebSocketEndpoints : EndpointGroupBase
{
    public override void Map(WebApplication app)
    {
        app.Map("/ws/room/{roomCode}", HandleGame);
        app.Map("/ws/lobby", HandleLobby);
    }

    public Task HandleGame(HttpContext context) =>
        context.RequestServices.GetRequiredService<GameHub>().HandleAsync(context);

    public async Task HandleLobby(HttpContext context)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        var rooms = context.RequestServices.GetRequiredService<IGameRoomManager>();
        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        var client = new WebSocketGameClient(socket);
        try
        {
            await rooms.ConnectLobbyAsync(client, context.RequestAborted);
            var buffer = new byte[1024];
            while (socket.State == WebSocketState.Open && !context.RequestAborted.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, context.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }
            }
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
        }
        catch (WebSocketException)
        {
        }
        finally
        {
            await rooms.DisconnectLobbyAsync(client, CancellationToken.None);
            await client.CloseAsync(CancellationToken.None);
        }
    }
}
