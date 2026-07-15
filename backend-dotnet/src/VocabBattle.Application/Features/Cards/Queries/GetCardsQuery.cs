using MediatR;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Repositories;

namespace VocabBattle.Application.Features.Cards.Queries;

public sealed record GetCardsQuery(string? CategoryId, string? Search, int Skip, int Limit)
    : IRequest<PagedResult<CardDto>>;

public sealed class GetCardsQueryHandler(ICardRepository repository)
    : IRequestHandler<GetCardsQuery, PagedResult<CardDto>>
{
    public async Task<PagedResult<CardDto>> Handle(GetCardsQuery request, CancellationToken cancellationToken)
    {
        var (cards, total) = await repository.ListAsync(
            request.CategoryId, request.Search, request.Skip, request.Limit, cancellationToken);

        return new PagedResult<CardDto>(cards.Select(CardMapper.ToDto).ToArray(), total);
    }
}
