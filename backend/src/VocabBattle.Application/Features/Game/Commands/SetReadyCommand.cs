using MediatR;
using VocabBattle.Application.Common.Interfaces;

namespace VocabBattle.Application.Features.Game.Commands;

public sealed record SetReadyCommand(string RoomCode, string PlayerId) : IRequest;

public sealed class SetReadyCommandHandler(IGameRoomManager rooms) : IRequestHandler<SetReadyCommand>
{
    public Task Handle(SetReadyCommand request, CancellationToken cancellationToken) =>
        rooms.SetReadyAsync(request.RoomCode, request.PlayerId, cancellationToken);
}
