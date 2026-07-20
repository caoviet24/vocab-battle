using MediatR;
using VocabBattle.Application.Common.Interfaces;

namespace VocabBattle.Application.Features.Game.Commands;

public sealed record SendPhoneticsCommand(string RoomCode, string PlayerId) : IRequest;

public sealed class SendPhoneticsCommandHandler(IGameRoomManager rooms) : IRequestHandler<SendPhoneticsCommand>
{
    public Task Handle(SendPhoneticsCommand request, CancellationToken cancellationToken) =>
        rooms.SendPhoneticsAsync(request.RoomCode, request.PlayerId, cancellationToken);
}
