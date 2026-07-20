namespace VocabBattle.Application.Common.Interfaces;

public interface IGameClient
{
    Task SendAsync(string type, object payload, CancellationToken cancellationToken = default);
    Task CloseAsync(CancellationToken cancellationToken = default);
}
