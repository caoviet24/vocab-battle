using MediatR;
using VocabBattle.Application.Common.Interfaces;

namespace VocabBattle.Application.Features.Game.Commands;

public sealed record TimeoutCommand(string RoomCode, string PlayerId) : IRequest;

public sealed class TimeoutCommandHandler(IGameRoomManager rooms) : IRequestHandler<TimeoutCommand>
{
    public Task Handle(TimeoutCommand request, CancellationToken cancellationToken) =>
        rooms.HandleTimeoutAsync(request.RoomCode, request.PlayerId, cancellationToken);
}
