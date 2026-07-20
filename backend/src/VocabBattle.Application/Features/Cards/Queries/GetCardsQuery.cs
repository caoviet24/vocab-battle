using MediatR;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Repositories;

namespace VocabBattle.Application.Features.Cards.Queries;

public sealed record GetCardsQuery(string? CategoryId, string? Search, int Page, int PageSize)
    : IRequest<PagedResult<CardDto>>
{
    public int Skip => (int)Math.Min((long)(Page - 1) * PageSize, int.MaxValue);
}

public sealed class GetCardsQueryHandler(ICardRepository repository)
    : IRequestHandler<GetCardsQuery, PagedResult<CardDto>>
{
    public async Task<PagedResult<CardDto>> Handle(GetCardsQuery request, CancellationToken cancellationToken)
    {
        var (cards, total) = await repository.ListAsync(
            request.CategoryId, request.Search, request.Skip, request.PageSize, cancellationToken);

        return new PagedResult<CardDto>(
            cards.Select(CardMapper.ToDto).ToArray(), total, request.Page, request.PageSize);
    }
}
