using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Entities;

namespace VocabBattle.Application.Common.Interfaces;

public sealed record RoomConnection(
    string RoomCode,
    string PlayerId,
    string PlayerName,
    string Password,
    bool IsHost,
    string FrameUrl = "");

public interface IGameRoomManager
{
    Task ConnectAsync(RoomConnection connection, IGameClient client, CancellationToken cancellationToken);
    Task DisconnectAsync(string roomCode, string playerId, IGameClient client, CancellationToken cancellationToken);
    Task StartGameAsync(string roomCode, string playerId, IReadOnlyList<Card> cards, CancellationToken cancellationToken);
    Task SubmitAnswerAsync(string roomCode, string playerId, string answer, CancellationToken cancellationToken);
    Task HandleTimeoutAsync(string roomCode, string playerId, CancellationToken cancellationToken);
    Task SendPhoneticsAsync(string roomCode, string playerId, CancellationToken cancellationToken);
    Task SetReadyAsync(string roomCode, string playerId, CancellationToken cancellationToken);
    IReadOnlyList<RoomSnapshotDto> GetRooms();

    // Lobby WS — push danh sách phòng realtime cho home page (thay cho poll /api/admin/rooms)
    Task ConnectLobbyAsync(IGameClient client, CancellationToken cancellationToken);
    Task DisconnectLobbyAsync(IGameClient client, CancellationToken cancellationToken);
}
