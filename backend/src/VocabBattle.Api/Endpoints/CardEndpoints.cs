using MediatR;
using VocabBattle.Api.Infrastructures;
using VocabBattle.Api.Serialization;
using VocabBattle.Application.Dtos;
using VocabBattle.Application.Features.Cards.Commands;
using VocabBattle.Application.Features.Cards.Queries;

namespace VocabBattle.Api.Endpoints;

public sealed class CardsEndpoints : EndpointGroupBase
{
    public override void Map(WebApplication app)
    {
        var group = app.MapGroup(this);
        group.MapGet(GetCards);
        group.MapPost(CreateCard);
        group.MapPut(UpdateCard, "{id}");
        group.MapDelete(DeleteCard, "{id}");
    }

    public async Task<IResult> GetCards(
        ISender sender,
        CardPayloadCipher cipher,
        string? categoryId,
        string? search,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken)
    {
        var query = new GetCardsQuery(
            categoryId,
            search,
            Math.Max(page ?? 1, 1),
            Math.Clamp(pageSize ?? 20, 1, 200));
        return Results.Ok(cipher.Encrypt(await sender.Send(query, cancellationToken)));
    }

    public async Task<IResult> CreateCard(
        CardInput input,
        ISender sender,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Word) || string.IsNullOrWhiteSpace(input.CategoryId))
        {
            return Results.BadRequest(new { message = "Word and category_id are required" });
        }

        return Results.Ok(await sender.Send(new CreateCardCommand(input), cancellationToken));
    }

    public async Task<IResult> UpdateCard(
        string id,
        CardInput input,
        ISender sender,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Word) || string.IsNullOrWhiteSpace(input.CategoryId))
        {
            return Results.BadRequest(new { message = "Word and category_id are required" });
        }

        var result = await sender.Send(new UpdateCardCommand(id, input), cancellationToken);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    public async Task<IResult> DeleteCard(
        string id,
        ISender sender,
        CancellationToken cancellationToken)
    {
        var deleted = await sender.Send(new DeleteCardCommand(id), cancellationToken);
        return deleted ? Results.NoContent() : Results.NotFound();
    }
}
