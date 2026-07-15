using VocabBattle.Domain.Entities;

namespace VocabBattle.Domain.Repositories;

public interface ICardRepository
{
    Task<IReadOnlyList<Card>> GetRandomAsync(string categoryId, int count, CancellationToken cancellationToken);

    Task<(IReadOnlyList<Card> Cards, long Total)> ListAsync(
        string? categoryId, string? search, int skip, int limit, CancellationToken cancellationToken);

    Task<Card> AddAsync(Card card, CancellationToken cancellationToken);
    Task<Card?> UpdateAsync(Card card, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);
}
