using MediatR;
using VocabBattle.Application.Common.Interfaces;
using VocabBattle.Domain.Exceptions;
using VocabBattle.Domain.Repositories;

namespace VocabBattle.Application.Features.Game.Commands;

public sealed record StartGameCommand(
    string RoomCode,
    string PlayerId,
    string CategoryId,
    int TotalQuestions) : IRequest;

public sealed class StartGameCommandHandler(ICardRepository cards, IGameRoomManager rooms)
    : IRequestHandler<StartGameCommand>
{
    public async Task Handle(StartGameCommand request, CancellationToken cancellationToken)
    {
        var selected = await cards.GetRandomAsync(
            request.CategoryId,
            request.TotalQuestions > 0 ? request.TotalQuestions : 10,
            cancellationToken);
        if (selected.Count == 0)
        {
            throw new GameRuleException("NO_QUESTIONS", "Không lấy được câu hỏi");
        }

        await rooms.StartGameAsync(request.RoomCode, request.PlayerId, selected, cancellationToken);
    }
}
