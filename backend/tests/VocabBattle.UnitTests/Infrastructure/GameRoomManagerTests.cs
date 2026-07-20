using VocabBattle.Application.Common.Interfaces;
using VocabBattle.Infrastructure.Realtime;
using Xunit;

namespace VocabBattle.UnitTests.Infrastructure;

public sealed class GameRoomManagerTests
{
    [Fact]
    public async Task EventsStayInsideTheirRoom()
    {
        var manager = new GameRoomManager();
        var playerA = new FakeGameClient();
        var playerB = new FakeGameClient();
        var playerC = new FakeGameClient();

        await manager.ConnectAsync(Connection("AB", "a", true), playerA, default);
        await manager.ConnectAsync(Connection("C", "c", true), playerC, default);
        playerC.Messages.Clear();

        await manager.ConnectAsync(Connection("AB", "b", false), playerB, default);

        Assert.Empty(playerC.Messages);
        Assert.Contains(playerA.Messages, message => message.Type == "PLAYER_JOINED");
        Assert.Contains(playerB.Messages, message => message.Type == "ROOM_STATE");
    }

    [Fact]
    public async Task ReconnectReplacesOldClientWithoutDuplicatingPlayer()
    {
        var manager = new GameRoomManager();
        var oldClient = new FakeGameClient();
        var newClient = new FakeGameClient();
        var connection = Connection("ROOM-A", "a", true);

        await manager.ConnectAsync(connection, oldClient, default);
        await manager.ConnectAsync(connection, newClient, default);

        Assert.True(oldClient.Closed);
        Assert.False(newClient.Closed);
        Assert.Equal(1, manager.GetRooms().Single().PlayerCount);
    }

    private static RoomConnection Connection(string room, string player, bool isHost) =>
        new(room, player, player.ToUpperInvariant(), string.Empty, isHost);

    private sealed class FakeGameClient : IGameClient
    {
        public List<(string Type, object Payload)> Messages { get; } = [];
        public bool Closed { get; private set; }

        public Task SendAsync(string type, object payload, CancellationToken cancellationToken = default)
        {
            Messages.Add((type, payload));
            return Task.CompletedTask;
        }

        public Task CloseAsync(CancellationToken cancellationToken = default)
        {
            Closed = true;
            return Task.CompletedTask;
        }
    }
}
