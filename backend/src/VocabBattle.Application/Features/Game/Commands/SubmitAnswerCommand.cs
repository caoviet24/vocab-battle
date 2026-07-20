using MediatR;
using VocabBattle.Application.Common.Interfaces;

namespace VocabBattle.Application.Features.Game.Commands;

public sealed record SubmitAnswerCommand(string RoomCode, string PlayerId, string Answer) : IRequest;

public sealed class SubmitAnswerCommandHandler(IGameRoomManager rooms) : IRequestHandler<SubmitAnswerCommand>
{
    public Task Handle(SubmitAnswerCommand request, CancellationToken cancellationToken) =>
        rooms.SubmitAnswerAsync(request.RoomCode, request.PlayerId, request.Answer, cancellationToken);
}
