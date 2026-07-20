using MediatR;
using VocabBattle.Application.Common.Interfaces;
using VocabBattle.Application.Dtos;

namespace VocabBattle.Application.Features.Rooms.Queries;

public sealed record GetRoomsQuery : IRequest<IReadOnlyList<RoomSnapshotDto>>;

public sealed class GetRoomsQueryHandler(IGameRoomManager roomManager)
    : IRequestHandler<GetRoomsQuery, IReadOnlyList<RoomSnapshotDto>>
{
    public Task<IReadOnlyList<RoomSnapshotDto>> Handle(GetRoomsQuery request, CancellationToken cancellationToken) =>
        Task.FromResult(roomManager.GetRooms());
}
