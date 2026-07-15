using MediatR;
using VocabBattle.Application.Dtos;
using VocabBattle.Application.Features.Cards.Commands;
using VocabBattle.Application.Features.Cards.Queries;

namespace VocabBattle.Api.Endpoints;

public static class CardEndpoints
{
    public static IEndpointRouteBuilder MapCardEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/cards", async (
            ISender sender,
            string? categoryId,
            string? search,
            int? skip,
            int? limit,
            CancellationToken cancellationToken) =>
        {
            var query = new GetCardsQuery(categoryId, search, skip ?? 0, Math.Min(limit ?? 50, 200));
            return Results.Ok(await sender.Send(query, cancellationToken));
        });

        endpoints.MapPost("/api/cards", async (CardInput input, ISender sender, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(input.Word) || string.IsNullOrWhiteSpace(input.CategoryId))
            {
                return Results.BadRequest(new { message = "Word and category_id are required" });
            }

            return Results.Ok(await sender.Send(new CreateCardCommand(input), cancellationToken));
        });

        endpoints.MapPut("/api/cards/{id}", async (string id, CardInput input, ISender sender, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(input.Word) || string.IsNullOrWhiteSpace(input.CategoryId))
            {
                return Results.BadRequest(new { message = "Word and category_id are required" });
            }

            var result = await sender.Send(new UpdateCardCommand(id, input), cancellationToken);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        endpoints.MapDelete("/api/cards/{id}", async (string id, ISender sender, CancellationToken cancellationToken) =>
        {
            var ok = await sender.Send(new DeleteCardCommand(id), cancellationToken);
            return ok ? Results.NoContent() : Results.NotFound();
        });

        return endpoints;
    }
}
