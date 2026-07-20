using System.Net.WebSockets;
using System.Text.Json;
using VocabBattle.Api.Contracts;
using VocabBattle.Api.Serialization;
using VocabBattle.Application.Common.Interfaces;

namespace VocabBattle.Api.Hubs;

public sealed class WebSocketGameClient(WebSocket socket) : IGameClient
{
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private int _closed;

    public async Task SendAsync(string type, object payload, CancellationToken cancellationToken = default)
    {
        if (socket.State != WebSocketState.Open)
        {
            throw new WebSocketException("WebSocket is not open");
        }

        var bytes = JsonSerializer.SerializeToUtf8Bytes(new OutgoingMessage(type, payload), JsonDefaults.Options);
        await _sendLock.WaitAsync(cancellationToken);
        try
        {
            await socket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken);
        }
        finally
        {
            _sendLock.Release();
        }
    }

    public async Task CloseAsync(CancellationToken cancellationToken = default)
    {
        if (Interlocked.Exchange(ref _closed, 1) != 0)
        {
            return;
        }

        try
        {
            if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
            {
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Disconnected", cancellationToken);
            }
        }
        catch (WebSocketException)
        {
            socket.Abort();
        }
    }
}
