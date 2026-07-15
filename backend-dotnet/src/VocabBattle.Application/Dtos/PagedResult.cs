namespace VocabBattle.Application.Dtos;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, long Total);
