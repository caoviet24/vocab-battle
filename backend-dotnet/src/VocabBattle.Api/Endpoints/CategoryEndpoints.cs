using MediatR;
using VocabBattle.Application.Dtos;
using VocabBattle.Application.Features.Categories.Commands;
using VocabBattle.Application.Features.Categories.Queries;

namespace VocabBattle.Api.Endpoints;

public static class CategoryEndpoints
{
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/categories", async (ISender sender, CancellationToken cancellationToken) =>
            Results.Ok(await sender.Send(new GetCategoriesQuery(), cancellationToken)));

        endpoints.MapPost("/api/categories", async (CategoryInput input, ISender sender, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name))
            {
                return Results.BadRequest(new { message = "Name is required" });
            }

            return Results.Ok(await sender.Send(new CreateCategoryCommand(input), cancellationToken));
        });

        endpoints.MapPut("/api/categories/{id}", async (string id, CategoryInput input, ISender sender, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name))
            {
                return Results.BadRequest(new { message = "Name is required" });
            }

            var result = await sender.Send(new UpdateCategoryCommand(id, input), cancellationToken);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        endpoints.MapDelete("/api/categories/{id}", async (string id, ISender sender, CancellationToken cancellationToken) =>
        {
            var ok = await sender.Send(new DeleteCategoryCommand(id), cancellationToken);
            return ok ? Results.NoContent() : Results.NotFound();
        });

        return endpoints;
    }
}
