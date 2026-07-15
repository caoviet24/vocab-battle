using MediatR;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Repositories;

namespace VocabBattle.Application.Features.Categories.Queries;

public sealed record GetCategoriesQuery : IRequest<IReadOnlyList<CategoryDto>>;

public sealed class GetCategoriesQueryHandler(ICategoryRepository repository)
    : IRequestHandler<GetCategoriesQuery, IReadOnlyList<CategoryDto>>
{
    public async Task<IReadOnlyList<CategoryDto>> Handle(
        GetCategoriesQuery request,
        CancellationToken cancellationToken)
    {
        var categories = await repository.ListAsync(cancellationToken);
        return categories.Select(DomainMapper.ToDto).ToArray();
    }
}
