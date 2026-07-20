namespace VocabBattle.Application.Dtos;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, long Total, int Page, int PageSize)
{
    public long TotalPages => Total == 0 ? 0 : ((Total - 1) / PageSize) + 1;
}
