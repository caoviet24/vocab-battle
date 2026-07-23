using MediatR;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Repositories;

namespace VocabBattle.Application.Features.Frames.Queries;

public sealed record GetFramesQuery : IRequest<IReadOnlyList<FrameDto>>;

public sealed class GetFramesQueryHandler(IFrameRepository repository)
    : IRequestHandler<GetFramesQuery, IReadOnlyList<FrameDto>>
{
    public async Task<IReadOnlyList<FrameDto>> Handle(GetFramesQuery request, CancellationToken cancellationToken) =>
        (await repository.ListAsync(cancellationToken)).Select(DomainMapper.ToDto).ToArray();
}
