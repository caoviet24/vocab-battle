using System.Collections.Concurrent;
using VocabBattle.Application.Common.Interfaces;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Enums;
using VocabBattle.Domain.Exceptions;
using VocabBattle.Domain.Results;

namespace VocabBattle.Infrastructure.Realtime;

public sealed class GameRoomManager : IGameRoomManager
{
    private readonly ConcurrentDictionary<string, GameRoomSession> _rooms =
        new(StringComparer.OrdinalIgnoreCase);

    // Lobby clients — nhận ROOMS_UPDATE realtime thay vì poll REST
    private readonly ConcurrentDictionary<IGameClient, byte> _lobbyClients = new();
    private readonly Timer _lobbyDebounce;

    public GameRoomManager()
    {
        _lobbyDebounce = new Timer(_ => _ = BroadcastLobbySafeAsync(), null, Timeout.Infinite, Timeout.Infinite);
    }

    // NotifyLobbyChange — debounce 300ms để gộp nhiều thay đổi thành một broadcast
    private void NotifyLobbyChange() =>
        _lobbyDebounce.Change(TimeSpan.FromMilliseconds(300), Timeout.InfiniteTimeSpan);

    private async Task BroadcastLobbySafeAsync()
    {
        try { await BroadcastLobbyAsync(); }
        catch { /* lobby broadcast không được làm fail luồng chính */ }
    }

    private async Task BroadcastLobbyAsync()
    {
        var rooms = GetRooms();
        foreach (var client in _lobbyClients.Keys)
        {
            try { await client.SendAsync("ROOMS_UPDATE", rooms, CancellationToken.None); }
            catch { _lobbyClients.TryRemove(client, out _); }
        }
    }

    public async Task ConnectLobbyAsync(IGameClient client, CancellationToken cancellationToken)
    {
        _lobbyClients.TryAdd(client, 0);
        await client.SendAsync("ROOMS_UPDATE", GetRooms(), cancellationToken);
    }

    public Task DisconnectLobbyAsync(IGameClient client, CancellationToken cancellationToken)
    {
        _lobbyClients.TryRemove(client, out _);
        return client.CloseAsync(cancellationToken);
    }

    public async Task ConnectAsync(
        RoomConnection connection,
        IGameClient client,
        CancellationToken cancellationToken)
    {
        GameRoomSession session;
        if (connection.IsHost)
        {
            session = _rooms.GetOrAdd(connection.RoomCode, code => new GameRoomSession(code));
        }
        else if (!_rooms.TryGetValue(connection.RoomCode, out session!))
        {
            throw new GameRuleException("ROOM_NOT_FOUND", "Phòng không tồn tại");
        }

        IGameClient? previous;
        bool joined;
        PlayerDto[] players;
        lock (session.Gate)
        {
            if (connection.IsHost)
            {
                session.Room.ConfigureHost(connection.PlayerId, connection.Password);
            }
            else if (!session.Room.VerifyPassword(connection.Password))
            {
                throw new GameRuleException("WRONG_PASSWORD", "Sai mật khẩu phòng");
            }

            session.Clients.TryGetValue(connection.PlayerId, out previous);
            session.Clients[connection.PlayerId] = client;
            joined = session.Room.AddPlayer(connection.PlayerId, connection.PlayerName, connection.FrameUrl);
            players = MapPlayers(session);
        }

        if (previous is not null && !ReferenceEquals(previous, client))
        {
            await previous.CloseAsync(cancellationToken);
        }

        await client.SendAsync("ROOM_STATE", new
        {
            Players = players,
            IsHost = session.Room.HostId == connection.PlayerId,
            HasPassword = session.Room.Password.Length > 0
        }, cancellationToken);

        if (joined)
        {
            await BroadcastAsync(session, "PLAYER_JOINED", players, cancellationToken);
            NotifyLobbyChange(); // player_count thay đổi
        }
    }

    public async Task DisconnectAsync(
        string roomCode,
        string playerId,
        IGameClient client,
        CancellationToken cancellationToken)
    {
        if (!_rooms.TryGetValue(roomCode, out var session))
        {
            return;
        }

        string? eventType = null;
        object? payload = null;
        IGameClient[] clients = [];
        var closeRoom = false;
        lock (session.Gate)
        {
            if (!session.Clients.TryGetValue(playerId, out var current) || !ReferenceEquals(current, client))
            {
                return;
            }

            session.Clients.Remove(playerId);
            session.Room.RemovePlayer(playerId);
            if (session.Clients.Count == 0)
            {
                _rooms.TryRemove(roomCode, out _);
                NotifyLobbyChange(); // room bị xóa
                return;
            }

            clients = session.Clients.Values.ToArray();
            if (playerId == session.Room.HostId)
            {
                session.Room.Finish();
                _rooms.TryRemove(roomCode, out _);
                eventType = "HOST_LEFT";
                payload = new { Message = "Chủ phòng đã thoát. Phòng đã bị đóng." };
                closeRoom = true;
            }
            else if (session.Clients.Count == 1 && session.Room.Status == GameStatus.Playing)
            {
                session.Room.ReturnToLobby();
                var winner = session.Room.Players.Single();
                eventType = "LAST_MAN_STANDING";
                payload = new
                {
                    WinnerId = winner.Id,
                    WinnerName = winner.Name,
                    Scoreboard = MapPlayers(session)
                };
            }
            else
            {
                eventType = "PLAYER_LEFT";
                payload = MapPlayers(session);
            }
        }

        await SendAllAsync(clients, eventType, payload!, cancellationToken);
        if (closeRoom)
        {
            await CloseAllAsync(clients, cancellationToken);
        }
        NotifyLobbyChange(); // host left / last man / player left → lobby list thay đổi
    }

    public async Task StartGameAsync(
        string roomCode,
        string playerId,
        IReadOnlyList<Card> cards,
        CancellationToken cancellationToken)
    {
        var session = GetSession(roomCode);
        lock (session.Gate)
        {
            session.Room.Start(playerId, cards);
        }

        NotifyLobbyChange(); // status → PLAYING
        await PublishNextQuestionAsync(roomCode, session, cancellationToken);
    }

    public async Task SubmitAnswerAsync(
        string roomCode,
        string playerId,
        string answer,
        CancellationToken cancellationToken)
    {
        var session = GetSession(roomCode);
        AnswerOutcome outcome;
        PlayerDto[] players;
        lock (session.Gate)
        {
            outcome = session.Room.SubmitAnswer(playerId, answer);
            players = MapPlayers(session);
        }

        if (outcome.Kind == AnswerOutcomeKind.Ignored)
        {
            return;
        }

        if (outcome.Kind == AnswerOutcomeKind.Incorrect)
        {
            await BroadcastAsync(session, "WRONG_ANSWER", new
            {
                PlayerId = playerId,
                PlayerName = outcome.Player!.Name,
                Answer = answer
            }, cancellationToken);
            return;
        }

        await BroadcastAsync(session, "CORRECT_ANSWER", new
        {
            WinnerId = playerId,
            WinnerName = outcome.Player!.Name,
            Card = CardMapper.ToDto(outcome.Card!),
            Scoreboard = players
        }, cancellationToken);
        _ = ContinueAfterDelayAsync(roomCode, session);
    }

    public async Task HandleTimeoutAsync(
        string roomCode,
        string playerId,
        CancellationToken cancellationToken)
    {
        var session = GetSession(roomCode);
        Card? card;
        PlayerDto[] players;
        lock (session.Gate)
        {
            card = session.Room.Timeout(playerId);
            players = MapPlayers(session);
        }

        if (card is null)
        {
            return;
        }

        await BroadcastAsync(session, "TIMEOUT_SKIP", new
        {
            Card = CardMapper.ToDto(card),
            Scoreboard = players
        }, cancellationToken);
        _ = ContinueAfterDelayAsync(roomCode, session);
    }

    public async Task SendPhoneticsAsync(
        string roomCode,
        string playerId,
        CancellationToken cancellationToken)
    {
        var session = GetSession(roomCode);
        IGameClient? client;
        PhoneticDto[] phonetics;
        lock (session.Gate)
        {
            session.Clients.TryGetValue(playerId, out client);
            phonetics = session.Room.CurrentCard?.Phonetics
                .Select(item => new PhoneticDto(item.Text, item.Audio, item.Locale))
                .ToArray() ?? [];
        }

        if (client is not null)
        {
            await client.SendAsync("PHONETICS", new { Phonetics = phonetics }, cancellationToken);
        }
    }

    public async Task SetReadyAsync(
        string roomCode,
        string playerId,
        CancellationToken cancellationToken)
    {
        var session = GetSession(roomCode);
        string[] readyIds;
        int total;
        lock (session.Gate)
        {
            session.Room.MarkReady(playerId);
            readyIds = session.Room.ReadyPlayerIds.ToArray();
            total = session.Room.Players.Count;
        }

        await BroadcastAsync(session, "READY_UPDATE", new
        {
            ReadyCount = readyIds.Length,
            Total = total,
            ReadyIds = readyIds
        }, cancellationToken);
    }

    public IReadOnlyList<RoomSnapshotDto> GetRooms() => _rooms.Values.Select(session =>
    {
        lock (session.Gate)
        {
            var players = MapPlayers(session);
            return new RoomSnapshotDto(
                session.Room.Code,
                session.Room.Status.ToString().ToUpperInvariant(),
                session.Room.HostId,
                session.Room.Password.Length > 0,
                players.Length,
                players);
        }
    }).ToArray();

    private async Task PublishNextQuestionAsync(
        string roomCode,
        GameRoomSession session,
        CancellationToken cancellationToken)
    {
        string eventType;
        object payload;
        lock (session.Gate)
        {
            if (!_rooms.TryGetValue(roomCode, out var current) || !ReferenceEquals(current, session))
            {
                return;
            }

            if (session.Room.CurrentCard is not { } card)
            {
                session.Room.Finish();
                eventType = "GAME_OVER";
                payload = MapPlayers(session);
            }
            else
            {
                session.Room.UnlockCurrentQuestion();
                eventType = "NEXT_QUESTION";
                payload = CardMapper.ToQuestionDto(
                    card,
                    session.Room.CurrentQuestionIndex + 1,
                    session.Room.TotalRounds);
            }
        }

        await BroadcastAsync(session, eventType, payload, cancellationToken);
        if (eventType == "GAME_OVER")
        {
            NotifyLobbyChange();
        }
    }

    private async Task ContinueAfterDelayAsync(string roomCode, GameRoomSession session)
    {
        await Task.Delay(TimeSpan.FromSeconds(3));
        await PublishNextQuestionAsync(roomCode, session, CancellationToken.None);
    }

    private GameRoomSession GetSession(string roomCode) =>
        _rooms.TryGetValue(roomCode, out var session)
            ? session
            : throw new GameRuleException("ROOM_NOT_FOUND", "Phòng không tồn tại");

    private static PlayerDto[] MapPlayers(GameRoomSession session) =>
        session.Room.Players.Select(DomainMapper.ToDto).ToArray();

    private static Task BroadcastAsync(
        GameRoomSession session,
        string type,
        object payload,
        CancellationToken cancellationToken)
    {
        IGameClient[] clients;
        lock (session.Gate)
        {
            clients = session.Clients.Values.ToArray();
        }

        return SendAllAsync(clients, type, payload, cancellationToken);
    }

    private static async Task SendAllAsync(
        IEnumerable<IGameClient> clients,
        string type,
        object payload,
        CancellationToken cancellationToken)
    {
        foreach (var client in clients)
        {
            try
            {
                await client.SendAsync(type, payload, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                await client.CloseAsync(CancellationToken.None);
            }
        }
    }

    private static async Task CloseAllAsync(
        IEnumerable<IGameClient> clients,
        CancellationToken cancellationToken)
    {
        foreach (var client in clients)
        {
            await client.CloseAsync(cancellationToken);
        }
    }
}
