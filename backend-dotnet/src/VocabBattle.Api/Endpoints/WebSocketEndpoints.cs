using System.Net.WebSockets;
using VocabBattle.Api.Hubs;
using VocabBattle.Application.Common.Interfaces;

namespace VocabBattle.Api.Endpoints;

public static class WebSocketEndpoints
{
    public static IEndpointRouteBuilder MapGameWebSocket(this IEndpointRouteBuilder endpoints)
    {
        endpoints.Map("/ws/room/{roomCode}", async context =>
            await context.RequestServices.GetRequiredService<GameHub>().HandleAsync(context));
        return endpoints;
    }

    // Lobby WS — push ROOMS_UPDATE realtime cho home page (thay cho poll /api/admin/rooms)
    public static IEndpointRouteBuilder MapLobbyWebSocket(this IEndpointRouteBuilder endpoints)
    {
        endpoints.Map("/ws/lobby", async context =>
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
                // Đọc để giữ connection & phát hiện ngắt; lobby client không gửi gì
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
        });
        return endpoints;
    }
}
