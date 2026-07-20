using VocabBattle.Application.Common.Interfaces;
using VocabBattle.Domain.Aggregates;

namespace VocabBattle.Infrastructure.Realtime;

internal sealed class GameRoomSession(string code)
{
    public object Gate { get; } = new();
    public GameRoom Room { get; } = new(code);
    public Dictionary<string, IGameClient> Clients { get; } = new(StringComparer.Ordinal);
}
