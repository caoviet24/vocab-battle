using MediatR;
using VocabBattle.Application.Features.Rooms.Queries;

namespace VocabBattle.Api.Endpoints;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/admin/rooms", async (ISender sender, CancellationToken cancellationToken) =>
            Results.Ok(await sender.Send(new GetRoomsQuery(), cancellationToken)));
        return endpoints;
    }
}
