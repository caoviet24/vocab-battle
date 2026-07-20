using MediatR;
using VocabBattle.Api.Infrastructures;
using VocabBattle.Application.Dtos;
using VocabBattle.Application.Features.Categories.Commands;
using VocabBattle.Application.Features.Categories.Queries;

namespace VocabBattle.Api.Endpoints;

public sealed class CategoriesEndpoints : EndpointGroupBase
{
    public override void Map(WebApplication app)
    {
        var group = app.MapGroup(this);
        group.MapGet(GetCategories);
        group.MapPost(CreateCategory);
        group.MapPut(UpdateCategory, "{id}");
        group.MapDelete(DeleteCategory, "{id}");
    }

    public async Task<IResult> GetCategories(ISender sender, CancellationToken cancellationToken) =>
        Results.Ok(await sender.Send(new GetCategoriesQuery(), cancellationToken));

    public async Task<IResult> CreateCategory(
        CategoryInput input,
        ISender sender,
        CancellationToken cancellationToken)
    {
        if (!IsValid(input))
        {
            return Results.BadRequest(new { message = "Category data is invalid" });
        }

        return Results.Ok(await sender.Send(new CreateCategoryCommand(input), cancellationToken));
    }

    public async Task<IResult> UpdateCategory(
        string id,
        CategoryInput input,
        ISender sender,
        CancellationToken cancellationToken)
    {
        if (!IsValid(input))
        {
            return Results.BadRequest(new { message = "Category data is invalid" });
        }

        var result = await sender.Send(new UpdateCategoryCommand(id, input), cancellationToken);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    public async Task<IResult> DeleteCategory(
        string id,
        ISender sender,
        CancellationToken cancellationToken)
    {
        var deleted = await sender.Send(new DeleteCategoryCommand(id), cancellationToken);
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private static bool IsValid(CategoryInput input) =>
        !string.IsNullOrWhiteSpace(input.Name) &&
        input.Name.Trim().Length <= 100 &&
        (input.Description?.Length ?? 0) <= 500 &&
        IsImageUrlValid(input.ImageUrl);

    private static bool IsImageUrlValid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        if (value.Length > 2048)
        {
            return false;
        }

        if ((value.StartsWith("/uploads/category/", StringComparison.Ordinal) ||
             value.StartsWith("/uploads/categories/", StringComparison.Ordinal)) &&
            !value.Contains("..", StringComparison.Ordinal))
        {
            return true;
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            uri.Scheme is "http" or "https";
    }
}
