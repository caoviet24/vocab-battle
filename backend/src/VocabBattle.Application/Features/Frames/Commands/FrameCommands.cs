using MediatR;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Repositories;

namespace VocabBattle.Application.Features.Frames.Commands;

public sealed record CreateFrameCommand(FrameInput Input) : IRequest<FrameDto>;

public sealed class CreateFrameCommandHandler(IFrameRepository repository)
    : IRequestHandler<CreateFrameCommand, FrameDto>
{
    public async Task<FrameDto> Handle(CreateFrameCommand request, CancellationToken cancellationToken) =>
        DomainMapper.ToDto(await repository.AddAsync(
            new Frame(string.Empty, request.Input.Name.Trim(), request.Input.Url.Trim(), DateTime.UtcNow),
            cancellationToken));
}

public sealed record UpdateFrameCommand(string Id, FrameInput Input) : IRequest<FrameDto?>;

public sealed class UpdateFrameCommandHandler(IFrameRepository repository)
    : IRequestHandler<UpdateFrameCommand, FrameDto?>
{
    public async Task<FrameDto?> Handle(UpdateFrameCommand request, CancellationToken cancellationToken)
    {
        var frame = await repository.UpdateAsync(
            new Frame(request.Id, request.Input.Name.Trim(), request.Input.Url.Trim(), DateTime.UtcNow),
            cancellationToken);
        return frame is null ? null : DomainMapper.ToDto(frame);
    }
}

public sealed record DeleteFrameCommand(string Id) : IRequest<bool>;

public sealed class DeleteFrameCommandHandler(IFrameRepository repository) : IRequestHandler<DeleteFrameCommand, bool>
{
    public Task<bool> Handle(DeleteFrameCommand request, CancellationToken cancellationToken) =>
        repository.DeleteAsync(request.Id, cancellationToken);
}
