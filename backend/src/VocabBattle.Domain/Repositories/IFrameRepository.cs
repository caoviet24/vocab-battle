using VocabBattle.Domain.Entities;

namespace VocabBattle.Domain.Repositories;

public interface IFrameRepository
{
    Task<IReadOnlyList<Frame>> ListAsync(CancellationToken cancellationToken);
    Task<Frame> AddAsync(Frame frame, CancellationToken cancellationToken);
    Task<Frame?> UpdateAsync(Frame frame, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);
}
