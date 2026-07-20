using MediatR;
using VocabBattle.Api.Infrastructures;
using VocabBattle.Application.Features.Rooms.Queries;

namespace VocabBattle.Api.Endpoints;

public sealed class AdminEndpoints : EndpointGroupBase
{
    public override void Map(WebApplication app)
    {
        app.MapGroup(this)
            .MapGet(GetAllRooms, "rooms");
    }

    private async Task<IResult> GetAllRooms(ISender sender, CancellationToken cancellationToken) =>
        Results.Ok(await sender.Send(new GetRoomsQuery(), cancellationToken));
}
